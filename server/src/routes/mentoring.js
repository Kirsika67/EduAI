import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { canAccessStudent, visibleClassIds } from "../services/access.js";
import { suggestGoalSteps } from "../services/mentorAssist.js";
import { ROLES } from "../constants/roles.js";

const router = Router();
router.use(requireAuth);

/** Mitu päeva ilma vestluseta enne kui õpilane "vajab kohtumist". */
const CHECK_IN_DUE_DAYS = 30;

const GOAL_CATEGORIES = ["Õppimine", "Käitumine", "Sotsiaalne", "Heaolu", "Tulevik"];

function isFamily(user) {
  return user.role === ROLES.PARENT || user.role === ROLES.STUDENT;
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const t = Date.parse(`${String(dateStr).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}

/* ---------------- Klassi mentorluse ülevaade ---------------- */

/**
 * Kes vajab kohtumist. Puhas arvutus: viimasest vestlusest möödunud päevad.
 * Mitte AI — "keda ma pole ammu näinud" on loendamine, mitte ennustamine.
 */
router.get("/overview/:classId", requireStaff, (req, res) => {
  const classId = Number(req.params.classId);
  if (!Number.isInteger(classId) || !visibleClassIds(req.user).includes(classId)) {
    return res.status(404).json({ error: "Klassi ei leitud." });
  }

  const rows = db
    .prepare(
      `SELECT s.id, s.name,
              (SELECT MAX(date) FROM mentor_notes m WHERE m.student_id = s.id) AS last_check_in,
              (SELECT COUNT(*) FROM student_goals g WHERE g.student_id = s.id AND g.status = 'open') AS open_goals,
              (SELECT COUNT(*) FROM student_goals g WHERE g.student_id = s.id AND g.status = 'done') AS done_goals
       FROM students s
       WHERE s.class_id = ?
       ORDER BY s.name COLLATE NOCASE`
    )
    .all(classId);

  const students = rows.map((r) => {
    const since = daysSince(r.last_check_in);
    return {
      studentId: r.id,
      studentName: r.name,
      lastCheckIn: r.last_check_in,
      daysSinceCheckIn: since,
      openGoals: r.open_goals,
      doneGoals: r.done_goals,
      needsCheckIn: since === null || since >= CHECK_IN_DUE_DAYS,
    };
  });

  res.json({
    students,
    needsCheckIn: students.filter((s) => s.needsCheckIn),
    checkInDueDays: CHECK_IN_DUE_DAYS,
    goalCategories: GOAL_CATEGORIES,
  });
});

/* ---------------- Ühe õpilase mentorlus ---------------- */

router.get("/student/:studentId", (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!Number.isInteger(studentId) || !canAccessStudent(req.user, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }

  const goals = db
    .prepare(
      `SELECT g.id, g.title, g.detail, g.kind, g.category, g.status, g.progress,
              g.target_date, g.created_at, t.name AS mentor_name
       FROM student_goals g
       LEFT JOIN teachers t ON t.id = g.mentor_id
       WHERE g.student_id = ?
       ORDER BY g.status, g.id DESC`
    )
    .all(studentId);

  /**
   * Perele näidatakse ainult jagatud märkmeid. Mentorivestluse sisu on
   * vaikimisi privaatne — vt migrations/faas5.js selgitust.
   */
  const notes = db
    .prepare(
      `SELECT m.id, m.note, m.date, m.kind, m.next_meeting_date, m.is_private,
              t.name AS mentor_name
       FROM mentor_notes m
       LEFT JOIN teachers t ON t.id = m.mentor_id
       WHERE m.student_id = ? ${isFamily(req.user) ? "AND m.is_private = 0" : ""}
       ORDER BY COALESCE(m.date, substr(m.created_at, 1, 10)) DESC, m.id DESC
       LIMIT 50`
    )
    .all(studentId);

  const lastCheckIn = notes[0]?.date || null;

  audit(req, {
    action: "mentoring.view",
    entityType: "student",
    entityId: studentId,
    studentId,
  });

  res.json({
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      detail: g.detail,
      kind: g.kind,
      category: g.category,
      status: g.status,
      progress: g.progress ?? 0,
      targetDate: g.target_date,
      mentorName: g.mentor_name,
    })),
    notes: notes.map((n) => ({
      id: n.id,
      note: n.note,
      date: n.date,
      kind: n.kind,
      nextMeetingDate: n.next_meeting_date,
      isPrivate: Boolean(n.is_private),
      mentorName: n.mentor_name,
    })),
    lastCheckIn,
    daysSinceCheckIn: daysSince(lastCheckIn),
    goalCategories: GOAL_CATEGORIES,
  });
});

/* ---------------- Eesmärgid ---------------- */

router.post("/goals", requireStaff, (req, res) => {
  const studentId = Number(req.body?.studentId);
  const title = String(req.body?.title || "").trim();
  const kind = req.body?.kind === "personal" ? "personal" : "academic";

  if (!Number.isInteger(studentId) || !canAccessStudent(req.user, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }
  if (title.length < 3) {
    return res.status(400).json({ error: "Sõnasta eesmärk pikemalt." });
  }

  const info = db
    .prepare(
      `INSERT INTO student_goals
         (student_id, title, detail, kind, category, target_date, mentor_id, progress, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`
    )
    .run(
      studentId,
      title.slice(0, 200),
      req.body?.detail ? String(req.body.detail).slice(0, 800) : null,
      kind,
      req.body?.category ? String(req.body.category).slice(0, 60) : null,
      req.body?.targetDate ? String(req.body.targetDate).slice(0, 10) : null,
      req.user.id
    );

  audit(req, {
    action: "mentoring.goal_create",
    entityType: "student_goal",
    entityId: info.lastInsertRowid,
    studentId,
  });
  res.status(201).json({ id: info.lastInsertRowid });
});

/**
 * Edenemise uuendamine. Õpilane tohib OMA eesmärgi edenemist ise liigutada —
 * see on tema eesmärk ja omanikutunne on mentorluse mõte. Eesmärgi teksti
 * ja staatuse muudab mentor.
 */
router.patch("/goals/:id", (req, res) => {
  const id = Number(req.params.id);
  const goal = db.prepare(`SELECT * FROM student_goals WHERE id = ?`).get(id);
  if (!goal || !canAccessStudent(req.user, goal.student_id)) {
    return res.status(404).json({ error: "Eesmärki ei leitud." });
  }

  const isOwnStudent =
    req.user.role === ROLES.STUDENT &&
    Number(req.user.linkedStudentId) === Number(goal.student_id);
  const staff = !isFamily(req.user);

  if (!staff && !isOwnStudent) {
    return res.status(403).json({ error: "Eesmärki muudab mentor või õpilane ise." });
  }

  const fields = [];
  const values = [];

  if (req.body?.progress !== undefined) {
    const p = Number(req.body.progress);
    if (!Number.isInteger(p) || p < 0 || p > 100) {
      return res.status(400).json({ error: "Edenemine peab olema 0-100." });
    }
    fields.push("progress = ?");
    values.push(p);
  }

  if (staff) {
    if (req.body?.status !== undefined) {
      const s = req.body.status === "done" ? "done" : "open";
      fields.push("status = ?");
      values.push(s);
    }
    if (req.body?.title !== undefined) {
      const t = String(req.body.title).trim();
      if (t.length < 3) return res.status(400).json({ error: "Eesmärk on liiga lühike." });
      fields.push("title = ?");
      values.push(t.slice(0, 200));
    }
    if (req.body?.detail !== undefined) {
      fields.push("detail = ?");
      values.push(req.body.detail ? String(req.body.detail).slice(0, 800) : null);
    }
    if (req.body?.targetDate !== undefined) {
      fields.push("target_date = ?");
      values.push(req.body.targetDate ? String(req.body.targetDate).slice(0, 10) : null);
    }
  }

  if (!fields.length) {
    return res.status(400).json({ error: "Midagi ei muudetud." });
  }

  fields.push("updated_at = datetime('now')");
  db.prepare(`UPDATE student_goals SET ${fields.join(", ")} WHERE id = ?`).run(...values, id);

  audit(req, {
    action: "mentoring.goal_update",
    entityType: "student_goal",
    entityId: id,
    studentId: goal.student_id,
  });
  res.json({ ok: true });
});

router.delete("/goals/:id", requireStaff, (req, res) => {
  const id = Number(req.params.id);
  const goal = db.prepare(`SELECT * FROM student_goals WHERE id = ?`).get(id);
  if (!goal || !canAccessStudent(req.user, goal.student_id)) {
    return res.status(404).json({ error: "Eesmärki ei leitud." });
  }
  db.prepare(`DELETE FROM student_goals WHERE id = ?`).run(id);
  audit(req, {
    action: "mentoring.goal_delete",
    entityType: "student_goal",
    entityId: id,
    studentId: goal.student_id,
  });
  res.json({ ok: true });
});

/* ---------------- Mentorivestluse märkmed ---------------- */

router.post("/notes", requireStaff, (req, res) => {
  const studentId = Number(req.body?.studentId);
  const note = String(req.body?.note || "").trim();

  if (!Number.isInteger(studentId) || !canAccessStudent(req.user, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }
  if (!note) return res.status(400).json({ error: "Kirjuta vestluse kokkuvõte." });

  const info = db
    .prepare(
      `INSERT INTO mentor_notes
         (student_id, note, mentor_id, kind, is_private, date, next_meeting_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      studentId,
      note.slice(0, 2000),
      req.user.id,
      req.body?.kind === "observation" ? "observation" : "check_in",
      /** Vaikimisi privaatne — jagamine on teadlik valik (vt faas5.js). */
      req.body?.isPrivate === false ? 0 : 1,
      String(req.body?.date || new Date().toISOString().slice(0, 10)).slice(0, 10),
      req.body?.nextMeetingDate ? String(req.body.nextMeetingDate).slice(0, 10) : null
    );

  audit(req, {
    action: "mentoring.note_create",
    entityType: "mentor_note",
    entityId: info.lastInsertRowid,
    studentId,
  });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.delete("/notes/:id", requireStaff, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare(`SELECT * FROM mentor_notes WHERE id = ?`).get(id);
  if (!row || !canAccessStudent(req.user, row.student_id)) {
    return res.status(404).json({ error: "Märget ei leitud." });
  }
  db.prepare(`DELETE FROM mentor_notes WHERE id = ?`).run(id);
  audit(req, {
    action: "mentoring.note_delete",
    entityType: "mentor_note",
    entityId: id,
    studentId: row.student_id,
  });
  res.json({ ok: true });
});

/* ---------------- AI: eesmärgi sammud ---------------- */

/**
 * Tagastab ettepaneku sammudeks. Ei loo eesmärki ega salvesta midagi —
 * mentor loeb, muudab ja lisab ise (RULE A1).
 */
router.post("/goals/suggest", requireStaff, async (req, res) => {
  const studentId = Number(req.body?.studentId);
  const goalTitle = String(req.body?.title || "").trim();

  if (!Number.isInteger(studentId) || !canAccessStudent(req.user, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }
  if (goalTitle.length < 3) {
    return res.status(400).json({ error: "Sõnasta eesmärk enne, kui AI abi küsid." });
  }

  const student = db.prepare(`SELECT name FROM students WHERE id = ?`).get(studentId);
  const result = await suggestGoalSteps({ studentName: student?.name || "", goalTitle }, req.user);

  audit(req, {
    action: "mentoring.ai_goal_suggest",
    entityType: "student",
    entityId: studentId,
    studentId,
  });
  res.json({ suggestion: result.text, fallback: result.fallback || null });
});

export default router;
