import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { visibleClassIds } from "../services/access.js";

const router = Router();
router.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function visibleClass(req, res) {
  const classId = Number(req.query.classId ?? req.body?.classId);
  if (!Number.isInteger(classId)) {
    res.status(400).json({ error: "Vali klass." });
    return null;
  }
  if (!visibleClassIds(req.user).includes(classId)) {
    res.status(404).json({ error: "Klassi ei leitud." });
    return null;
  }
  return classId;
}

router.get("/", (req, res) => {
  const classId = visibleClass(req, res);
  if (classId === null) return;

  const from = String(req.query.from || "").slice(0, 10);
  const to = String(req.query.to || "").slice(0, 10);
  const hasRange = DATE_RE.test(from) && DATE_RE.test(to);

  const rows = db
    .prepare(
      `SELECT a.id, a.subject, a.title, a.description, a.kind, a.due_date, t.name AS teacher_name
       FROM assignments a
       LEFT JOIN teachers t ON t.id = a.created_by
       WHERE a.class_id = ? ${hasRange ? "AND a.due_date BETWEEN ? AND ?" : ""}
       ORDER BY a.due_date, a.id`
    )
    .all(...(hasRange ? [classId, from, to] : [classId]));

  res.json({
    assignments: rows.map((r) => ({
      id: r.id,
      subject: r.subject,
      title: r.title,
      description: r.description,
      kind: r.kind,
      dueDate: r.due_date,
      teacherName: r.teacher_name,
    })),
  });
});

router.post("/", requireStaff, (req, res) => {
  const classId = visibleClass(req, res);
  if (classId === null) return;

  const subject = String(req.body?.subject || "").trim();
  const title = String(req.body?.title || "").trim();
  const dueDate = String(req.body?.dueDate || "").slice(0, 10);
  const kind = req.body?.kind === "task" ? "task" : "homework";
  if (!subject) return res.status(400).json({ error: "Sisesta aine." });
  if (!title) return res.status(400).json({ error: "Sisesta pealkiri." });
  if (!DATE_RE.test(dueDate)) return res.status(400).json({ error: "Vali tähtaeg." });

  const info = db
    .prepare(
      `INSERT INTO assignments (class_id, subject, title, description, kind, due_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      classId,
      subject.slice(0, 80),
      title.slice(0, 160),
      req.body?.description ? String(req.body.description).slice(0, 2000) : null,
      kind,
      dueDate,
      req.user.id
    );

  audit(req, { action: "assignment.create", entityType: "assignment", entityId: info.lastInsertRowid });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete("/:id", requireStaff, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`SELECT id, class_id FROM assignments WHERE id = ?`).get(id);
  if (!row || !visibleClassIds(req.user).includes(Number(row.class_id))) {
    return res.status(404).json({ error: "Ülesannet ei leitud." });
  }
  db.prepare(`DELETE FROM assignments WHERE id = ?`).run(id);
  audit(req, { action: "assignment.delete", entityType: "assignment", entityId: id });
  res.json({ ok: true });
});

export default router;
