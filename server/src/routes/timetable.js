import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { visibleClassIds } from "../services/access.js";
import { analyseWeekLoad, suggestRebalance } from "../services/workloadBalance.js";

const router = Router();
router.use(requireAuth);

/**
 * Tunniplaani näeb igaüks, kes seda klassi näeb — ka vanem ja õpilane
 * (nende jaoks on see ainus viis teada, millal tunnid on). Muuta tohib
 * ainult koolitöötaja; seda valvab requireStaff marsruudi kaupa (RULE R1).
 */
function canSeeClass(user, classId) {
  return visibleClassIds(user).includes(Number(classId));
}

/** Esmaspäev, mille nädalasse antud kuupäev kuulub. */
function weekStart(dateStr) {
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const dow = (d.getDay() + 6) % 7; // esmaspäev = 0
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function requireVisibleClass(req, res) {
  const classId = Number(req.query.classId ?? req.body?.classId);
  if (!Number.isInteger(classId)) {
    res.status(400).json({ error: "Vali klass." });
    return null;
  }
  if (!canSeeClass(req.user, classId)) {
    res.status(404).json({ error: "Klassi ei leitud." });
    return null;
  }
  return classId;
}

/* ---------------- Tunniplaan ---------------- */

router.get("/", (req, res) => {
  const classId = requireVisibleClass(req, res);
  if (classId === null) return;

  const monday = weekStart(req.query.week || new Date().toISOString().slice(0, 10));
  if (!monday) return res.status(400).json({ error: "Kehtetu nädal." });
  const sunday = addDays(monday, 6);

  const entries = db
    .prepare(
      `SELECT t.id, t.subject, t.room, t.day_of_week, t.lesson_number,
              t.start_time, t.end_time, t.teacher_id, te.name AS teacher_name
       FROM timetable_entries t
       LEFT JOIN teachers te ON te.id = t.teacher_id
       WHERE t.class_id = ?
       ORDER BY t.day_of_week, t.lesson_number`
    )
    .all(classId);

  const subs = db
    .prepare(
      `SELECT s.id, s.timetable_entry_id, s.date, s.new_room, s.cancelled, s.note,
              s.substitute_teacher_id, te.name AS substitute_name
       FROM substitutions s
       LEFT JOIN teachers te ON te.id = s.substitute_teacher_id
       JOIN timetable_entries t ON t.id = s.timetable_entry_id
       WHERE t.class_id = ? AND s.date BETWEEN ? AND ?`
    )
    .all(classId, monday, sunday);

  const subsByEntry = new Map();
  for (const s of subs) subsByEntry.set(s.timetable_entry_id, s);

  res.json({
    week: { start: monday, end: sunday },
    entries: entries.map((e) => {
      const sub = subsByEntry.get(e.id) || null;
      return {
        id: e.id,
        subject: e.subject,
        room: e.room,
        dayOfWeek: e.day_of_week,
        lessonNumber: e.lesson_number,
        startTime: e.start_time,
        endTime: e.end_time,
        teacherName: e.teacher_name,
        substitution: sub
          ? {
              id: sub.id,
              date: sub.date,
              cancelled: Boolean(sub.cancelled),
              newRoom: sub.new_room,
              substituteName: sub.substitute_name,
              note: sub.note,
            }
          : null,
      };
    }),
  });
});

router.post("/", requireStaff, (req, res) => {
  const classId = requireVisibleClass(req, res);
  if (classId === null) return;

  const subject = String(req.body?.subject || "").trim();
  const dayOfWeek = Number(req.body?.dayOfWeek);
  const lessonNumber = Number(req.body?.lessonNumber);

  if (!subject) return res.status(400).json({ error: "Sisesta aine." });
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
    return res.status(400).json({ error: "Vali nädalapäev." });
  }
  if (!Number.isInteger(lessonNumber) || lessonNumber < 1 || lessonNumber > 12) {
    return res.status(400).json({ error: "Tunni number peab olema 1-12." });
  }

  const taken = db
    .prepare(
      `SELECT id FROM timetable_entries
       WHERE class_id = ? AND day_of_week = ? AND lesson_number = ?`
    )
    .get(classId, dayOfWeek, lessonNumber);
  if (taken) {
    return res
      .status(409)
      .json({ error: "Sellel ajal on juba tund. Kustuta vana või vali teine tund." });
  }

  const info = db
    .prepare(
      `INSERT INTO timetable_entries
         (class_id, subject, teacher_id, room, day_of_week, lesson_number, start_time, end_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      classId,
      subject.slice(0, 80),
      req.user.id,
      req.body?.room ? String(req.body.room).slice(0, 40) : null,
      dayOfWeek,
      lessonNumber,
      req.body?.startTime ? String(req.body.startTime).slice(0, 5) : null,
      req.body?.endTime ? String(req.body.endTime).slice(0, 5) : null
    );

  audit(req, {
    action: "timetable.create",
    entityType: "timetable_entry",
    entityId: info.lastInsertRowid,
  });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete("/:id", requireStaff, (req, res) => {
  const id = Number(req.params.id);
  const row = db
    .prepare(`SELECT id, class_id FROM timetable_entries WHERE id = ?`)
    .get(id);
  if (!row || !canSeeClass(req.user, row.class_id)) {
    return res.status(404).json({ error: "Tundi ei leitud." });
  }
  db.prepare(`DELETE FROM timetable_entries WHERE id = ?`).run(id);
  audit(req, { action: "timetable.delete", entityType: "timetable_entry", entityId: id });
  res.json({ ok: true });
});

/* ---------------- Asendused ja ärajäänud tunnid ---------------- */

router.post("/substitutions", requireStaff, (req, res) => {
  const entryId = Number(req.body?.timetableEntryId);
  const date = String(req.body?.date || "").slice(0, 10);
  const row = db
    .prepare(`SELECT id, class_id FROM timetable_entries WHERE id = ?`)
    .get(entryId);

  if (!row || !canSeeClass(req.user, row.class_id)) {
    return res.status(404).json({ error: "Tundi ei leitud." });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Vali kuupäev." });
  }

  const info = db
    .prepare(
      `INSERT INTO substitutions
         (timetable_entry_id, date, substitute_teacher_id, new_room, cancelled, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(timetable_entry_id, date) DO UPDATE SET
         substitute_teacher_id = excluded.substitute_teacher_id,
         new_room = excluded.new_room,
         cancelled = excluded.cancelled,
         note = excluded.note`
    )
    .run(
      entryId,
      date,
      req.body?.substituteTeacherId ? Number(req.body.substituteTeacherId) : null,
      req.body?.newRoom ? String(req.body.newRoom).slice(0, 40) : null,
      req.body?.cancelled ? 1 : 0,
      req.body?.note ? String(req.body.note).slice(0, 300) : null,
      req.user.id
    );

  audit(req, {
    action: "timetable.substitution",
    entityType: "substitution",
    entityId: info.lastInsertRowid,
  });
  res.status(201).json({ ok: true });
});

router.delete("/substitutions/:id", requireStaff, (req, res) => {
  const id = Number(req.params.id);
  const row = db
    .prepare(
      `SELECT s.id, t.class_id FROM substitutions s
       JOIN timetable_entries t ON t.id = s.timetable_entry_id
       WHERE s.id = ?`
    )
    .get(id);
  if (!row || !canSeeClass(req.user, row.class_id)) {
    return res.status(404).json({ error: "Muudatust ei leitud." });
  }
  db.prepare(`DELETE FROM substitutions WHERE id = ?`).run(id);
  res.json({ ok: true });
});

/* ---------------- Eksamid ja kontrolltööd ---------------- */

router.get("/exams", async (req, res) => {
  const classId = requireVisibleClass(req, res);
  if (classId === null) return;

  const from = String(req.query.from || "").slice(0, 10);
  const to = String(req.query.to || "").slice(0, 10);
  const hasRange = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to);

  const exams = hasRange
    ? db
        .prepare(
          `SELECT id, subject, title, date FROM exams
           WHERE class_id = ? AND date BETWEEN ? AND ? ORDER BY date, id`
        )
        .all(classId, from, to)
    : db
        .prepare(`SELECT id, subject, title, date FROM exams WHERE class_id = ? ORDER BY date, id`)
        .all(classId);

  res.json({ exams, load: analyseWeekLoad(hasRange ? exams : []) });
});

router.post("/exams", requireStaff, (req, res) => {
  const classId = requireVisibleClass(req, res);
  if (classId === null) return;

  const subject = String(req.body?.subject || "").trim();
  const date = String(req.body?.date || "").slice(0, 10);
  if (!subject) return res.status(400).json({ error: "Sisesta aine." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Vali kuupäev." });
  }

  const info = db
    .prepare(
      `INSERT INTO exams (class_id, subject, title, date, created_by) VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      classId,
      subject.slice(0, 80),
      req.body?.title ? String(req.body.title).slice(0, 160) : null,
      date,
      req.user.id
    );

  audit(req, { action: "exam.create", entityType: "exam", entityId: info.lastInsertRowid });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete("/exams/:id", requireStaff, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`SELECT id, class_id FROM exams WHERE id = ?`).get(id);
  if (!row || !canSeeClass(req.user, row.class_id)) {
    return res.status(404).json({ error: "Tööd ei leitud." });
  }
  db.prepare(`DELETE FROM exams WHERE id = ?`).run(id);
  audit(req, { action: "exam.delete", entityType: "exam", entityId: id });
  res.json({ ok: true });
});

/**
 * Õpikoormuse hinnang. Hoiatus on alati olemas (arvutatud), AI soovitus
 * lisandub ainult siis, kui võti on olemas ja koormus on ebaühtlane.
 */
router.get("/workload", requireStaff, async (req, res) => {
  const classId = requireVisibleClass(req, res);
  if (classId === null) return;

  const monday = weekStart(req.query.week || new Date().toISOString().slice(0, 10));
  if (!monday) return res.status(400).json({ error: "Kehtetu nädal." });
  const sunday = addDays(monday, 6);

  const klass = db.prepare(`SELECT name FROM classes WHERE id = ?`).get(classId);
  const exams = db
    .prepare(
      `SELECT id, subject, title, date FROM exams
       WHERE class_id = ? AND date BETWEEN ? AND ? ORDER BY date`
    )
    .all(classId, monday, sunday);

  const load = analyseWeekLoad(exams);
  let ai = { text: null, fallback: null };
  if (load.level === "warning") {
    ai = await suggestRebalance(
      { className: klass?.name || "", weekRange: `${monday} – ${sunday}`, exams },
      req.user
    );
  }

  res.json({ week: { start: monday, end: sunday }, load, aiSuggestion: ai.text, aiFallback: ai.fallback });
});

export default router;
