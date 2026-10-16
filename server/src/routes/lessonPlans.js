import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { visibleClassIds } from "../services/access.js";

const router = Router();
router.use(requireAuth, requireStaff);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function visibleClass(req, res) {
  const classId = Number(req.query.classId ?? req.body?.classId);
  if (!Number.isInteger(classId) || !visibleClassIds(req.user).includes(classId)) {
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
  const ranged = DATE_RE.test(from) && DATE_RE.test(to);
  const rows = db
    .prepare(
      `SELECT id, date, title, content FROM lesson_plans
       WHERE class_id = ? ${ranged ? "AND date BETWEEN ? AND ?" : ""} ORDER BY date, id`
    )
    .all(...(ranged ? [classId, from, to] : [classId]));
  res.json({ lessonPlans: rows });
});

router.post("/", (req, res) => {
  const classId = visibleClass(req, res);
  if (classId === null) return;
  const date = String(req.body?.date || "").slice(0, 10);
  const title = String(req.body?.title || "").trim();
  if (!DATE_RE.test(date)) return res.status(400).json({ error: "Vali kuupäev." });
  if (!title) return res.status(400).json({ error: "Sisesta pealkiri." });
  const info = db
    .prepare(`INSERT INTO lesson_plans (class_id, date, title, content, created_by) VALUES (?, ?, ?, ?, ?)`)
    .run(classId, date, title.slice(0, 160), req.body?.content ? String(req.body.content).slice(0, 6000) : null, req.user.id);
  audit(req, { action: "lesson_plan.create", entityType: "lesson_plan", entityId: info.lastInsertRowid });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`SELECT id, class_id FROM lesson_plans WHERE id = ?`).get(id);
  if (!row || !visibleClassIds(req.user).includes(Number(row.class_id))) {
    return res.status(404).json({ error: "Tunnikava ei leitud." });
  }
  db.prepare(`DELETE FROM lesson_plans WHERE id = ?`).run(id);
  audit(req, { action: "lesson_plan.delete", entityType: "lesson_plan", entityId: id });
  res.json({ ok: true });
});

export default router;
