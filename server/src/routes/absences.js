import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { audit } from "../services/audit.js";

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
      isMine: Number(r.teacher_id) === Number(req.user.id),
    })),
  });
});

/** Õpetaja teatab enda puudumisest. */
router.post("/", (req, res) => {
  const dateFrom = String(req.body?.dateFrom || "").slice(0, 10);
  const dateTo = String(req.body?.dateTo || dateFrom).slice(0, 10);
  if (!DATE_RE.test(dateFrom) || !DATE_RE.test(dateTo)) {
    return res.status(400).json({ error: "Vali kuupäevad." });
  }
  if (dateTo < dateFrom) {
    return res.status(400).json({ error: "Lõpp ei tohi olla enne algust." });
  }
  const info = db
    .prepare(`INSERT INTO teacher_absences (teacher_id, date_from, date_to, note) VALUES (?, ?, ?, ?)`)
    .run(req.user.id, dateFrom, dateTo, req.body?.note ? String(req.body.note).slice(0, 300) : null);
  audit(req, { action: "absence.create", entityType: "teacher_absence", entityId: info.lastInsertRowid });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`SELECT id, teacher_id FROM teacher_absences WHERE id = ?`).get(id);
  if (!row || Number(row.teacher_id) !== Number(req.user.id)) {
    return res.status(404).json({ error: "Puudumist ei leitud." });
  }
  db.prepare(`DELETE FROM teacher_absences WHERE id = ?`).run(id);
  audit(req, { action: "absence.delete", entityType: "teacher_absence", entityId: id });
  res.json({ ok: true });
});

export default router;
