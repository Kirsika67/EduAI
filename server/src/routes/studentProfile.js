import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { abcForStudent } from "../services/abcRisk.js";
import { audit } from "../services/audit.js";

const router = Router();
router.use(requireAuth);

/** 'excused' (vabastatud) lisandus Faas 1b-ga; ABC-risk ei loe seda puudumiseks. */
const ATTENDANCE_STATUSES = new Set(["present", "late", "absent", "excused"]);

function assertOwnClass(teacherId, classId) {
  return db
    .prepare(`SELECT id FROM classes WHERE id = ? AND teacher_id = ?`)
    .get(classId, teacherId);
}

function assertOwnStudent(teacherId, classId, studentId) {
  if (!assertOwnClass(teacherId, classId)) return null;
  return db
    .prepare(
      `SELECT s.id FROM students s WHERE s.id = ? AND s.class_id = ?`
    )
    .get(studentId, classId);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

router.get("/classes/:classId/abc-risks", (req, res) => {
  const classId = Number(req.params.classId);
  if (!Number.isInteger(classId)) {
    return res.status(400).json({ error: "Kehtetu ID." });
  }
  if (!assertOwnClass(req.teacherId, classId)) {
    return res.status(404).json({ error: "Klassi ei leitud." });
  }

  const students = db
    .prepare(
      `SELECT id, name FROM students WHERE class_id = ? ORDER BY name COLLATE NOCASE`
    )
    .all(classId);

  res.json({
    students: students.map((st) => ({
      studentId: st.id,
      studentName: st.name,
      ...abcForStudent(db, st.id),
    })),
  });
});

router.post("/classes/:classId/attendance", (req, res) => {
  const classId = Number(req.params.classId);
  if (!Number.isInteger(classId) || !assertOwnClass(req.teacherId, classId)) {
    return res.status(404).json({ error: "Klassi ei leitud." });
  }

  const date = String(req.body?.date || todayIso()).slice(0, 10);
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  /** lesson_number 0 = terve päev. Ilma tunnita kutse käitub täpselt nagu enne. */
  const lessonNumber = Number.isInteger(Number(req.body?.lessonNumber))
    ? Number(req.body.lessonNumber)
    : 0;
  const subject = req.body?.subject ? String(req.body.subject).slice(0, 80) : null;

  const upsert = db.prepare(`
    INSERT INTO attendance (student_id, class_id, date, lesson_number, subject, status, reason, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(student_id, date, lesson_number) DO UPDATE SET
      status = excluded.status,
      reason = excluded.reason,
      notes = excluded.notes,
      subject = excluded.subject
  `);

  const savedStudentIds = [];
  const tx = db.transaction(() => {
    for (const row of entries) {
      const studentId = Number(row.studentId);
      const status = String(row.status || "");
      if (!Number.isInteger(studentId) || !ATTENDANCE_STATUSES.has(status)) continue;
      const owned = db
        .prepare(`SELECT id FROM students WHERE id = ? AND class_id = ?`)
        .get(studentId, classId);
      if (!owned) continue;
      upsert.run(
        studentId,
        classId,
        date,
        lessonNumber,
        subject,
        status,
        row.reason ? String(row.reason).slice(0, 400) : null,
        row.notes ? String(row.notes).slice(0, 400) : null
      );
      savedStudentIds.push(studentId);
    }
  });
  tx();

  for (const studentId of savedStudentIds) {
    audit(req, { action: "attendance.save", entityType: "attendance", studentId });
  }

  const saved = db
    .prepare(
      `SELECT a.student_id, a.status, a.lesson_number FROM attendance a
       JOIN students s ON s.id = a.student_id
       WHERE s.class_id = ? AND a.date = ? AND a.lesson_number = ?`
    )
    .all(classId, date, lessonNumber);

  res.json({ date, lessonNumber, attendance: saved });
});

router.get("/classes/:classId/attendance", (req, res) => {
  const classId = Number(req.params.classId);
  const date = String(req.query.date || todayIso()).slice(0, 10);
  if (!Number.isInteger(classId) || !assertOwnClass(req.teacherId, classId)) {
    return res.status(404).json({ error: "Klassi ei leitud." });
  }

  /** Vaikimisi terve päev (0) — nii käitub olemasolev UI täpselt nagu enne. */
  const lessonNumber = Number.isInteger(Number(req.query.lessonNumber))
    ? Number(req.query.lessonNumber)
    : 0;

  const rows = db
    .prepare(
      `SELECT a.student_id, a.status, a.lesson_number FROM attendance a
       JOIN students s ON s.id = a.student_id
       WHERE s.class_id = ? AND a.date = ? AND a.lesson_number = ?`
    )
    .all(classId, date, lessonNumber);

  res.json({ date, lessonNumber, attendance: rows });
});

router.post("/classes/:classId/students/:studentId/attendance", (req, res) => {
  const classId = Number(req.params.classId);
  const studentId = Number(req.params.studentId);
  if (!assertOwnStudent(req.teacherId, classId, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }

  const date = String(req.body?.date || todayIso()).slice(0, 10);
  const status = String(req.body?.status || "");
  if (!ATTENDANCE_STATUSES.has(status)) {
    return res
      .status(400)
      .json({ error: "Vali kohal / hilines / puudus / vabastatud." });
  }
  const lessonNumber = Number.isInteger(Number(req.body?.lessonNumber))
    ? Number(req.body.lessonNumber)
    : 0;

  db.prepare(
    `INSERT INTO attendance (student_id, class_id, date, lesson_number, status, reason, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(student_id, date, lesson_number) DO UPDATE SET
       status = excluded.status,
       reason = excluded.reason,
       notes = excluded.notes`
  ).run(
    studentId,
    classId,
    date,
    lessonNumber,
    status,
    req.body?.reason ? String(req.body.reason).slice(0, 400) : null,
    req.body?.notes ? String(req.body.notes).slice(0, 400) : null
  );

  audit(req, { action: "attendance.save", entityType: "attendance", studentId });
  res.status(201).json({ ok: true, abc: abcForStudent(db, studentId) });
});

router.delete("/classes/:classId/students/:studentId/attendance/:id", (req, res) => {
  const classId = Number(req.params.classId);
  const studentId = Number(req.params.studentId);
  const id = Number(req.params.id);
  if (!assertOwnStudent(req.teacherId, classId, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }
  db.prepare(`DELETE FROM attendance WHERE id = ? AND student_id = ?`).run(id, studentId);
  res.json({ ok: true, abc: abcForStudent(db, studentId) });
});

router.post("/classes/:classId/students/:studentId/behavior", (req, res) => {
  const classId = Number(req.params.classId);
  const studentId = Number(req.params.studentId);
  if (!assertOwnStudent(req.teacherId, classId, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }
  const kind = String(req.body?.kind || "");
  const note = String(req.body?.note || "").trim();
  if (!["positive", "concern", "incident"].includes(kind) || !note) {
    return res.status(400).json({ error: "Lisa märkuse tüüp ja tekst." });
  }
  const date = String(req.body?.date || todayIso()).slice(0, 10);
  const info = db
    .prepare(
      `INSERT INTO behavior_notes (student_id, date, kind, note) VALUES (?, ?, ?, ?)`
    )
    .run(studentId, date, kind, note.slice(0, 800));
  audit(req, {
    action: "behavior.create",
    entityType: "behavior_note",
    entityId: info.lastInsertRowid,
    studentId,
  });
  res.status(201).json({ id: info.lastInsertRowid, abc: abcForStudent(db, studentId) });
});

router.delete("/classes/:classId/students/:studentId/behavior/:id", (req, res) => {
  const classId = Number(req.params.classId);
  const studentId = Number(req.params.studentId);
  const id = Number(req.params.id);
  if (!assertOwnStudent(req.teacherId, classId, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }
  db.prepare(`DELETE FROM behavior_notes WHERE id = ? AND student_id = ?`).run(id, studentId);
  audit(req, {
    action: "behavior.delete",
    entityType: "behavior_note",
    entityId: id,
    studentId,
  });
  res.json({ ok: true, abc: abcForStudent(db, studentId) });
});

router.post("/classes/:classId/students/:studentId/wellbeing", (req, res) => {
  const classId = Number(req.params.classId);
  const studentId = Number(req.params.studentId);
  if (!assertOwnStudent(req.teacherId, classId, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }
  const mood = String(req.body?.mood || "");
  if (!["good", "ok", "hard"].includes(mood)) {
    return res.status(400).json({ error: "Vali enesetunne." });
  }
  const date = String(req.body?.date || todayIso()).slice(0, 10);
  const info = db
    .prepare(
      `INSERT INTO wellbeing_checkins (student_id, date, mood, note) VALUES (?, ?, ?, ?)`
    )
    .run(
      studentId,
      date,
      mood,
      req.body?.note ? String(req.body.note).slice(0, 400) : null
    );
  audit(req, {
    action: "wellbeing.create",
    entityType: "wellbeing_checkin",
    entityId: info.lastInsertRowid,
    studentId,
  });
  res.status(201).json({ id: info.lastInsertRowid, abc: abcForStudent(db, studentId) });
});

router.post("/classes/:classId/students/:studentId/goals", (req, res) => {
  const classId = Number(req.params.classId);
  const studentId = Number(req.params.studentId);
  if (!assertOwnStudent(req.teacherId, classId, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }
  const title = String(req.body?.title || "").trim();
  const kind = String(req.body?.kind || "academic");
  if (!title || !["academic", "personal"].includes(kind)) {
    return res.status(400).json({ error: "Lisa eesmärk." });
  }
  const info = db
    .prepare(
      `INSERT INTO student_goals (student_id, title, kind) VALUES (?, ?, ?)`
    )
    .run(studentId, title.slice(0, 200), kind);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.patch("/classes/:classId/students/:studentId/goals/:id", (req, res) => {
  const classId = Number(req.params.classId);
  const studentId = Number(req.params.studentId);
  const id = Number(req.params.id);
  if (!assertOwnStudent(req.teacherId, classId, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }
  const status = String(req.body?.status || "");
  if (!["open", "done"].includes(status)) {
    return res.status(400).json({ error: "Kehtetu staatus." });
  }
  db.prepare(
    `UPDATE student_goals SET status = ? WHERE id = ? AND student_id = ?`
  ).run(status, id, studentId);
  res.json({ ok: true });
});

router.post("/classes/:classId/students/:studentId/mentor-notes", (req, res) => {
  const classId = Number(req.params.classId);
  const studentId = Number(req.params.studentId);
  if (!assertOwnStudent(req.teacherId, classId, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }
  const note = String(req.body?.note || "").trim();
  if (!note) return res.status(400).json({ error: "Lisa märkus." });
  const info = db
    .prepare(`INSERT INTO mentor_notes (student_id, note) VALUES (?, ?)`)
    .run(studentId, note.slice(0, 2000));
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete("/classes/:classId/students/:studentId/mentor-notes/:id", (req, res) => {
  const classId = Number(req.params.classId);
  const studentId = Number(req.params.studentId);
  const id = Number(req.params.id);
  if (!assertOwnStudent(req.teacherId, classId, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }
  db.prepare(`DELETE FROM mentor_notes WHERE id = ? AND student_id = ?`).run(id, studentId);
  res.json({ ok: true });
});

export default router;
