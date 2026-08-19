import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { generateWeeklyClassPlan } from "../services/weeklyPlanGeneration.js";

const router = Router();

router.use(requireAuth);

function assertOwnClass(teacherId, classId) {
  return db
    .prepare(`SELECT id, name, subject FROM classes WHERE id = ? AND teacher_id = ?`)
    .get(classId, teacherId);
}

/** Kohalik esmaspäev YYYY-MM-DD */
function mondayISO(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeWeekStart(raw) {
  if (!raw || typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    return mondayISO();
  }
  const d = new Date(`${raw.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) return mondayISO();
  return mondayISO(d);
}

router.get("/classes/:classId/weekly-plans", (req, res) => {
  const classId = Number(req.params.classId);
  if (!Number.isInteger(classId)) {
    return res.status(400).json({ error: "Kehtetu klassi ID." });
  }

  if (!assertOwnClass(req.teacherId, classId)) {
    return res.status(404).json({ error: "Klassi ei leitud." });
  }

  const rows = db
    .prepare(
      `SELECT id, class_id, week_start, title, plan_text, reminders_json, created_at
       FROM weekly_plans
       WHERE class_id = ?
       ORDER BY datetime(week_start) DESC, id DESC`
    )
    .all(classId);

  const plans = rows.map((r) => ({
    id: r.id,
    class_id: r.class_id,
    week_start: r.week_start,
    title: r.title,
    plan_text: r.plan_text,
    created_at: r.created_at,
    reminders: safeParseReminders(r.reminders_json),
  }));

  res.json({ plans });
});

function safeParseReminders(json) {
  try {
    const x = JSON.parse(json);
    return Array.isArray(x) ? x : [];
  } catch {
    return [];
  }
}

router.post("/classes/:classId/weekly-plans/generate", async (req, res) => {
  const classId = Number(req.params.classId);
  if (!Number.isInteger(classId)) {
    return res.status(400).json({ error: "Kehtetu klassi ID." });
  }

  const klass = assertOwnClass(req.teacherId, classId);
  if (!klass) {
    return res.status(404).json({ error: "Klassi ei leitud." });
  }

  const { weekStart, focusNotes } = req.body || {};
  const week = normalizeWeekStart(
    typeof weekStart === "string" ? weekStart : null
  );

  const topicNames = db
    .prepare(`SELECT name FROM topics WHERE class_id = ? ORDER BY name`)
    .all(classId)
    .map((t) => t.name);

  const studentRow = db
    .prepare(`SELECT COUNT(*) AS n FROM students WHERE class_id = ?`)
    .get(classId);
  const studentCount = studentRow ? Number(studentRow.n) : 0;

  const focus =
    focusNotes && String(focusNotes).trim()
      ? String(focusNotes).trim().slice(0, 2000)
      : null;

  let result;
  try {
    result = await generateWeeklyClassPlan(
      {
        className: klass.name,
        subject: klass.subject,
        weekStartEt: week,
        topicNames,
        studentCount: Number(studentCount) || 0,
        focusNotes: focus,
      },
      req.user
    );
  } catch (e) {
    console.error("[EduAI nädala plaan]", e?.message || e);
    return res.status(500).json({
      error:
        e?.message && typeof e.message === "string"
          ? e.message
          : "Nädala plaani genereerimine ebaõnnestus.",
    });
  }

  const remindersJson = JSON.stringify(result.reminders);

  const info = db
    .prepare(
      `INSERT INTO weekly_plans (class_id, week_start, title, plan_text, reminders_json)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      classId,
      week,
      result.title.slice(0, 500),
      result.planText,
      remindersJson
    );

  const row = db
    .prepare(
      `SELECT id, class_id, week_start, title, plan_text, reminders_json, created_at
       FROM weekly_plans WHERE id = ?`
    )
    .get(info.lastInsertRowid);

  res.status(201).json({
    plan: {
      id: row.id,
      class_id: row.class_id,
      week_start: row.week_start,
      title: row.title,
      plan_text: row.plan_text,
      created_at: row.created_at,
      reminders: result.reminders,
    },
  });
});

export default router;
