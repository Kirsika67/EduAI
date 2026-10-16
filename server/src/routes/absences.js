import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { isLeadership, isStaff } from "../constants/roles.js";

const router = Router();
router.use(requireAuth, requireStaff);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Kooli õpetajate puudumised, mis katavad antud päeva (vaikimisi täna). Ainult oma kooli omad. */
router.get("/", (req, res) => {
  const day = DATE_RE.test(String(req.query.date || "")) ? String(req.query.date) : new Date().toISOString().slice(0, 10);
  const rows = db
    .prepare(
      `SELECT a.id, a.teacher_id, a.date_from, a.date_to, a.note, t.name AS teacher_name
       FROM teacher_absences a
       JOIN teachers t ON t.id = a.teacher_id
       WHERE t.school_id IS ? AND ? BETWEEN a.date_from AND a.date_to
       ORDER BY t.name`
    )
    .all(req.user.schoolId ?? null, day);
  res.json({
    absences: rows.map((r) => ({
      id: r.id,
      teacherId: r.teacher_id,
      teacherName: r.teacher_name,
      dateFrom: r.date_from,
      dateTo: r.date_to,
      note: r.note,
      isMine: Number(r.teacher_id) === Number(req.user.id) || isLeadership(req.user.role),
    })),
  });
});

/** Kooli koolitöötajad, kelle eest juhtkond tohib puudumise sisestada. */
router.get("/teachers", (req, res) => {
  if (!isLeadership(req.user.role)) return res.json({ teachers: [] });
  const rows = db
    .prepare(`SELECT id, name, role FROM teachers WHERE school_id IS ? ORDER BY name COLLATE NOCASE`)
    .all(req.user.schoolId ?? null);
  res.json({ teachers: rows.filter((r) => isStaff(r.role)).map((r) => ({ id: r.id, name: r.name })) });
});

/** Õpetaja teatab enda puudumisest; juhtkond tohib seda teha kooli mis tahes õpetaja eest. */
router.post("/", (req, res) => {
  const dateFrom = String(req.body?.dateFrom || "").slice(0, 10);
  const dateTo = String(req.body?.dateTo || dateFrom).slice(0, 10);
  if (!DATE_RE.test(dateFrom) || !DATE_RE.test(dateTo)) {
    return res.status(400).json({ error: "Vali kuupäevad." });
  }
  if (dateTo < dateFrom) {
    return res.status(400).json({ error: "Lõpp ei tohi olla enne algust." });
  }
  let teacherId = req.user.id;
  const requested = Number(req.body?.teacherId);
  if (Number.isInteger(requested) && requested !== Number(req.user.id)) {
    const target = db.prepare(`SELECT id, school_id, role FROM teachers WHERE id = ?`).get(requested);
    if (
      !isLeadership(req.user.role) ||
      !target ||
      !isStaff(target.role) ||
      Number(target.school_id) !== Number(req.user.schoolId)
    ) {
      return res.status(403).json({ error: "Sul pole õigust selle õpetaja puudumist sisestada." });
    }
    teacherId = target.id;
  }
  const info = db
    .prepare(`INSERT INTO teacher_absences (teacher_id, date_from, date_to, note) VALUES (?, ?, ?, ?)`)
    .run(teacherId, dateFrom, dateTo, req.body?.note ? String(req.body.note).slice(0, 300) : null);
  audit(req, { action: "absence.create", entityType: "teacher_absence", entityId: info.lastInsertRowid });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const row = db
    .prepare(
      `SELECT a.id, a.teacher_id, t.school_id FROM teacher_absences a
       JOIN teachers t ON t.id = a.teacher_id WHERE a.id = ?`
    )
    .get(id);
  const mayDelete =
    row &&
    (Number(row.teacher_id) === Number(req.user.id) ||
      (isLeadership(req.user.role) && Number(row.school_id) === Number(req.user.schoolId)));
  if (!mayDelete) {
    return res.status(404).json({ error: "Puudumist ei leitud." });
  }
  db.prepare(`DELETE FROM teacher_absences WHERE id = ?`).run(id);
  audit(req, { action: "absence.delete", entityType: "teacher_absence", entityId: id });
  res.json({ ok: true });
});

export default router;
