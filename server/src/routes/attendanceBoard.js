import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { canAccessStudent, visibleClassIds } from "../services/access.js";
import { abcForStudent } from "../services/abcRisk.js";
import {
  summariseAttendance,
  dailySeries,
  CHRONIC_THRESHOLD_PERCENT,
} from "../services/attendanceStats.js";
import {
  BEHAVIOR_CATEGORIES,
  BEHAVIOR_KINDS,
  sentimentOf,
} from "../constants/behavior.js";

const router = Router();
router.use(requireAuth);

function assertVisibleClass(req, res, classId) {
  if (!Number.isInteger(classId)) {
    res.status(400).json({ error: "Vali klass." });
    return false;
  }
  if (!visibleClassIds(req.user).includes(classId)) {
    res.status(404).json({ error: "Klassi ei leitud." });
    return false;
  }
  return true;
}

/**
 * Klassi kohaloleku tahvel: õpilased, tänane staatus ja iga õpilase
 * 30 päeva kokkuvõte ühes päringus, et leht ei peaks tegema N päringut.
 */
router.get("/board/:classId", requireStaff, (req, res) => {
  const classId = Number(req.params.classId);
  if (!assertVisibleClass(req, res, classId)) return;

  const date = String(req.query.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const lessonNumber = Number.isInteger(Number(req.query.lessonNumber))
    ? Number(req.query.lessonNumber)
    : 0;

  const students = db
    .prepare(`SELECT id, name FROM students WHERE class_id = ? ORDER BY name COLLATE NOCASE`)
    .all(classId);

  const todayRows = db
    .prepare(
      `SELECT a.student_id, a.status, a.reason FROM attendance a
       JOIN students s ON s.id = a.student_id
       WHERE s.class_id = ? AND a.date = ? AND a.lesson_number = ?`
    )
    .all(classId, date, lessonNumber);
  const todayMap = new Map(todayRows.map((r) => [r.student_id, r]));

  const historyRows = db
    .prepare(
      `SELECT a.student_id, a.date, a.status FROM attendance a
       JOIN students s ON s.id = a.student_id
       WHERE s.class_id = ?`
    )
    .all(classId);
  const historyByStudent = new Map();
  for (const r of historyRows) {
    if (!historyByStudent.has(r.student_id)) historyByStudent.set(r.student_id, []);
    historyByStudent.get(r.student_id).push(r);
  }

  const rows = students.map((st) => {
    const today = todayMap.get(st.id) || null;
    const summary = summariseAttendance(historyByStudent.get(st.id) || []);
    return {
      studentId: st.id,
      studentName: st.name,
      today: today ? { status: today.status, reason: today.reason } : null,
      summary,
    };
  });

  const chronic = rows
    .filter((r) => r.summary.isChronic)
    .map((r) => ({
      studentId: r.studentId,
      studentName: r.studentName,
      absencePercent: r.summary.absencePercent,
      absent: r.summary.absent,
    }));

  res.json({
    date,
    lessonNumber,
    students: rows,
    chronic,
    chronicThresholdPercent: CHRONIC_THRESHOLD_PERCENT,
    behaviorCategories: BEHAVIOR_CATEGORIES,
  });
});

/**
 * Klassi hiljutised käitumismärkused (ainult koolitöötajale).
 * RULE: seda vaadet ei tohi kunagi näha klassikaaslane — vanema ja õpilase
 * roll ei jõua siia, sest requireStaff tõrjub nad eespool.
 */
router.get("/behavior/class/:classId", requireStaff, (req, res) => {
  const classId = Number(req.params.classId);
  if (!assertVisibleClass(req, res, classId)) return;

  const rows = db
    .prepare(
      `SELECT b.id, b.student_id, b.date, b.kind, b.category, b.note, b.is_private,
              s.name AS student_name, t.name AS teacher_name
       FROM behavior_notes b
       JOIN students s ON s.id = b.student_id
       LEFT JOIN teachers t ON t.id = b.teacher_id
       WHERE s.class_id = ?
       ORDER BY b.date DESC, b.id DESC
       LIMIT 60`
    )
    .all(classId);

  res.json({
    notes: rows.map((r) => ({
      id: r.id,
      studentId: r.student_id,
      studentName: r.student_name,
      date: r.date,
      kind: r.kind,
      sentiment: sentimentOf(r.kind),
      category: r.category,
      note: r.note,
      isPrivate: Boolean(r.is_private),
      teacherName: r.teacher_name,
    })),
    categories: BEHAVIOR_CATEGORIES,
  });
});

/**
 * Ühe õpilase käitumislugu. Siia pääseb ka vanem ja õpilane ise — aga
 * ainult oma kirjete juurde, mida valvab canAccessStudent (RULE R2).
 * Eraviisilised märkmed (`is_private`) jäävad perele nägemata.
 */
router.get("/behavior/student/:studentId", (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!Number.isInteger(studentId)) {
    return res.status(400).json({ error: "Kehtetu ID." });
  }
  if (!canAccessStudent(req.user, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }

  const isFamily = req.user.role === "parent" || req.user.role === "student";
  const rows = db
    .prepare(
      `SELECT b.id, b.date, b.kind, b.category, b.note, b.is_private, t.name AS teacher_name
       FROM behavior_notes b
       LEFT JOIN teachers t ON t.id = b.teacher_id
       WHERE b.student_id = ? ${isFamily ? "AND b.is_private = 0" : ""}
       ORDER BY b.date DESC, b.id DESC
       LIMIT 60`
    )
    .all(studentId);

  audit(req, {
    action: "behavior.view_student",
    entityType: "student",
    entityId: studentId,
    studentId,
  });

  res.json({
    notes: rows.map((r) => ({
      id: r.id,
      date: r.date,
      kind: r.kind,
      sentiment: sentimentOf(r.kind),
      category: r.category,
      note: r.note,
      teacherName: r.teacher_name,
    })),
  });
});

/** Käitumismärkuse lisamine koos kategooriaga. */
router.post("/behavior", requireStaff, (req, res) => {
  const studentId = Number(req.body?.studentId);
  const kind = String(req.body?.kind || "");
  const note = String(req.body?.note || "").trim();

  if (!Number.isInteger(studentId) || !canAccessStudent(req.user, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }
  if (!BEHAVIOR_KINDS.includes(kind)) {
    return res.status(400).json({ error: "Vali märkuse tüüp." });
  }
  if (!note) {
    return res.status(400).json({ error: "Kirjelda, mis juhtus." });
  }

  const date = String(req.body?.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const info = db
    .prepare(
      `INSERT INTO behavior_notes (student_id, date, kind, note, category, teacher_id, is_private)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      studentId,
      date,
      kind,
      note.slice(0, 800),
      req.body?.category ? String(req.body.category).slice(0, 60) : null,
      req.user.id,
      /**
       * Vaikimisi JAGATUD (0), mitte privaatne. Lapse käitumismärkus on lapse
       * andmed — vanemal on GDPR-i järgi niikuinii õigus neid näha ja varjamine
       * vaikimisi tekitaks usaldamatust. Eraviisiline märkus on teadlik valik.
       */
      req.body?.isPrivate === true ? 1 : 0
    );

  audit(req, {
    action: "behavior.create",
    entityType: "behavior_note",
    entityId: info.lastInsertRowid,
    studentId,
  });

  res.status(201).json({ id: info.lastInsertRowid, abc: abcForStudent(db, studentId) });
});

router.delete("/behavior/:id", requireStaff, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`SELECT id, student_id FROM behavior_notes WHERE id = ?`).get(id);
  if (!row || !canAccessStudent(req.user, row.student_id)) {
    return res.status(404).json({ error: "Märkust ei leitud." });
  }
  db.prepare(`DELETE FROM behavior_notes WHERE id = ?`).run(id);
  audit(req, {
    action: "behavior.delete",
    entityType: "behavior_note",
    entityId: id,
    studentId: row.student_id,
  });
  res.json({ ok: true, abc: abcForStudent(db, row.student_id) });
});

/**
 * Ühe õpilase kohaloleku kokkuvõte + päevade jada graafiku jaoks.
 * Kättesaadav ka perele — see on nende enda laps.
 */
router.get("/summary/:studentId", (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!Number.isInteger(studentId)) {
    return res.status(400).json({ error: "Kehtetu ID." });
  }
  if (!canAccessStudent(req.user, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }

  const rows = db
    .prepare(`SELECT date, status FROM attendance WHERE student_id = ? ORDER BY date`)
    .all(studentId);

  const abc = abcForStudent(db, studentId);
  res.json({
    summary: summariseAttendance(rows),
    series: dailySeries(rows),
    risk: {
      level: abc.level,
      label: abc.label,
      riskScore: abc.riskScore,
      riskLabel: abc.riskLabel,
      reasons: abc.reasons,
      components: abc.components,
    },
  });
});

export default router;
