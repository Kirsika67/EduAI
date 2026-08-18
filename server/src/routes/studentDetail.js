import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { runStudentAiAnalysis } from "../services/studentAnalysis.js";
import { abcForStudent } from "../services/abcRisk.js";
import { audit } from "../services/audit.js";

const router = Router();

router.use(requireAuth);

function assertOwnClass(teacherId, classId) {
  return db
    .prepare(`SELECT id FROM classes WHERE id = ? AND teacher_id = ?`)
    .get(classId, teacherId);
}

function buildFallbackAnalysis({ studentName, className, subject, gradeRows }) {
  const sorted = [...gradeRows].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );
  const latest = sorted[0];
  const avg =
    gradeRows.reduce((s, g) => s + Number(g.score), 0) / gradeRows.length;
  const latestTopic = latest?.topic_name || "viimane teema";
  const latestScore = Number(latest?.score ?? avg);

  let tone;
  if (avg < 50) {
    tone =
      "Tulemused on nõrgad; soovitame põhiteemade süstemaatilist kordamist ja väikeseid sammhaaval harjutusi.";
  } else if (avg < 70) {
    tone =
      "Tulemused on keskmised; jätkake harjutamist ja pöörake tähelepanu eksimustele viimases kontrolltöös.";
  } else {
    tone =
      "Tulemused on head; hoidke tempot ja lisage vahelduva raskusega ülesandeid.";
  }

  const mainProblem = `${studentName} keskmine hinne on ${Math.round(avg)}%. Viimane hinne teemal "${latestTopic}": ${latestScore}%. ${tone}`;

  const suggestedTasks = `1) Korda teemat "${latestTopic}" (15 min päevas).
2) Lahenda 5 harjutust – alusta lihtsamatest, liigu raskemate juurde.
3) Kirjuta üles, millised ülesanded tekitasid raskusi, ja too need järgmises tunnis arutlusele.`;

  const parentEmail = `Lugupeetud lapsevanem!

Kirjutan Teile õpilase ${studentName} kohta (${className}, ${subject}). Viimase perioodi tulemused on keskmiselt ${Math.round(avg)}%. ${tone}

Palun julgustage last regulaarselt harjutama ja võtke meiega ühendust, kui märkate, et kodune tugi on vajalik.

Lugupidamisega
Klassiõpetaja`;

  return {
    mainProblem,
    hypothesis:
      "Ilma AI ühenduseta: võimalikud põhjused on lüngad eelmistes teemades, vähene harjutamine või ajapuudus kontrolltööks.",
    plan4Weeks: `Nädal 1: korda "${latestTopic}" põhitõed.\nNädal 2: harjuta keskmise raskusega ülesandeid.\nNädal 3: lahenda keerukamaid ülesandeid koos õpetajaga.\nNädal 4: korda ja tee lühike enesehindamine.`,
    suggestedTasks,
    parentEmail,
    parentSms: `${studentName}: keskmine hinne ${Math.round(avg)}%. Palun toetage kodust harjutamist teemal "${latestTopic}".`,
    fallback: true,
  };
}

router.get("/classes/:classId/students/:studentId/detail", (req, res) => {
  const classId = Number(req.params.classId);
  const studentId = Number(req.params.studentId);
  if (!Number.isInteger(classId) || !Number.isInteger(studentId)) {
    return res.status(400).json({ error: "Kehtetu ID." });
  }

  if (!assertOwnClass(req.teacherId, classId)) {
    return res.status(404).json({ error: "Klassi ei leitud." });
  }

  const student = db
    .prepare(
      `SELECT s.id, s.class_id, s.name, s.created_at
       FROM students s WHERE s.id = ? AND s.class_id = ?`
    )
    .get(studentId, classId);

  if (!student) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }

  const klass = db
    .prepare(`SELECT id, name, subject FROM classes WHERE id = ?`)
    .get(classId);

  const gradeRows = db
    .prepare(
      `SELECT g.id, g.score, g.date, g.notes, t.id AS topic_id, t.name AS topic_name
       FROM grades g
       JOIN topics t ON t.id = g.topic_id
       WHERE g.student_id = ?
       ORDER BY g.date ASC, g.id ASC`
    )
    .all(studentId);

  const trendSeries = gradeRows.map((r) => ({
    date: r.date,
    score: r.score,
    topicName: r.topic_name,
    topicId: r.topic_id,
  }));

  /** @type {Record<number, { topicId: number, topicName: string, grades: object[] }>} */
  const byTopic = {};
  for (const r of gradeRows) {
    if (!byTopic[r.topic_id]) {
      byTopic[r.topic_id] = {
        topicId: r.topic_id,
        topicName: r.topic_name,
        grades: [],
      };
    }
    byTopic[r.topic_id].grades.push({
      id: r.id,
      score: r.score,
      date: r.date,
      notes: r.notes,
    });
  }
  const gradesByTopic = Object.values(byTopic).sort((a, b) =>
    a.topicName.localeCompare(b.topicName, "et")
  );

  const classTopicAverages = db
    .prepare(
      `SELECT t.id AS topic_id, t.name AS topic_name, AVG(g.score) AS avg_score
       FROM topics t
       JOIN grades g ON g.topic_id = t.id
       JOIN students s ON s.id = g.student_id AND s.class_id = t.class_id
       WHERE t.class_id = ?
       GROUP BY t.id`
    )
    .all(classId)
    .map((r) => ({
      topicId: r.topic_id,
      topicName: r.topic_name,
      averagePercent: Math.round(Number(r.avg_score) * 10) / 10,
    }));

  const lastPlan = db
    .prepare(
      `SELECT id, plan_text, weeks, analysis_json, created_at
       FROM learning_plans
       WHERE student_id = ?
       ORDER BY datetime(created_at) DESC, id DESC
       LIMIT 1`
    )
    .get(studentId);

  let lastAnalysis = null;
  if (lastPlan?.analysis_json) {
    try {
      lastAnalysis = JSON.parse(lastPlan.analysis_json);
      lastAnalysis.savedAt = lastPlan.created_at;
    } catch {
      lastAnalysis = null;
    }
  }

  const attendance = db
    .prepare(
      `SELECT id, date, status, notes, created_at
       FROM attendance WHERE student_id = ?
       ORDER BY date DESC, id DESC LIMIT 40`
    )
    .all(studentId);

  const behavior = db
    .prepare(
      `SELECT id, date, kind, note, created_at
       FROM behavior_notes WHERE student_id = ?
       ORDER BY date DESC, id DESC LIMIT 40`
    )
    .all(studentId);

  const wellbeing = db
    .prepare(
      `SELECT id, date, mood, note, created_at
       FROM wellbeing_checkins WHERE student_id = ?
       ORDER BY date DESC, id DESC LIMIT 20`
    )
    .all(studentId);

  const goals = db
    .prepare(
      `SELECT id, title, kind, status, created_at
       FROM student_goals WHERE student_id = ?
       ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, id DESC`
    )
    .all(studentId);

  const mentorNotes = db
    .prepare(
      `SELECT id, note, created_at
       FROM mentor_notes WHERE student_id = ?
       ORDER BY datetime(created_at) DESC, id DESC LIMIT 40`
    )
    .all(studentId);

  /** RULE R3 — tundliku profiili vaatamine logitakse, mitte ainult muutmine. */
  audit(req, { action: "student.view_detail", entityType: "student", entityId: studentId, studentId });

  res.json({
    student,
    class: klass,
    abc: abcForStudent(db, studentId),
    attendance,
    behavior,
    wellbeing,
    goals,
    mentorNotes,
    grades: gradeRows.map((r) => ({
      id: r.id,
      score: r.score,
      date: r.date,
      notes: r.notes,
      topicId: r.topic_id,
      topicName: r.topic_name,
    })),
    gradesByTopic,
    trendSeries,
    classTopicAverages,
    lastPlan: lastPlan
      ? {
          id: lastPlan.id,
          planText: lastPlan.plan_text,
          weeks: lastPlan.weeks,
          createdAt: lastPlan.created_at,
        }
      : null,
    lastAnalysis,
  });
});

router.post("/classes/:classId/students/:studentId/ai-analysis", async (req, res) => {
  const classId = Number(req.params.classId);
  const studentId = Number(req.params.studentId);
  if (!Number.isInteger(classId) || !Number.isInteger(studentId)) {
    return res.status(400).json({ error: "Kehtetu ID." });
  }

  if (!assertOwnClass(req.teacherId, classId)) {
    return res.status(404).json({ error: "Klassi ei leitud." });
  }

  const student = db
    .prepare(
      `SELECT s.id, s.name FROM students s WHERE s.id = ? AND s.class_id = ?`
    )
    .get(studentId, classId);

  if (!student) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }

  const klass = db
    .prepare(`SELECT name, subject FROM classes WHERE id = ?`)
    .get(classId);

  const gradeRows = db
    .prepare(
      `SELECT g.score, g.date, g.notes, t.name AS topic_name
       FROM grades g
       JOIN topics t ON t.id = g.topic_id
       WHERE g.student_id = ?
       ORDER BY g.date ASC, g.id ASC`
    )
    .all(studentId);

  if (gradeRows.length === 0) {
    return res.status(400).json({
      error: "AI analüüsi jaoks on vaja vähemalt ühte hinnet.",
    });
  }

  const classTopicAverages = db
    .prepare(
      `SELECT t.name AS topic_name, AVG(g.score) AS avg_score
       FROM topics t
       JOIN grades g ON g.topic_id = t.id
       JOIN students s ON s.id = g.student_id AND s.class_id = t.class_id
       WHERE t.class_id = ?
       GROUP BY t.id`
    )
    .all(classId)
    .map((r) => ({
      topic: r.topic_name,
      average: Math.round(Number(r.avg_score) * 10) / 10,
    }));

  try {
    const analysis = await runStudentAiAnalysis(
      {
        studentName: student.name,
        className: klass.name,
        subject: klass.subject,
        grades: gradeRows.map((r) => ({
          teema: r.topic_name,
          kuupaev: r.date,
          hinne: r.score,
          markus: r.notes || null,
        })),
        classTopicAverages,
      },
      process.env.ANTHROPIC_API_KEY
    );

    const jsonStr = JSON.stringify(analysis);
    const info = db
      .prepare(
        `INSERT INTO learning_plans (student_id, plan_text, weeks, analysis_json)
         VALUES (?, ?, 4, ?)`
      )
      .run(studentId, analysis.plan4Weeks, jsonStr);

    res.status(201).json({
      analysis,
      learningPlanId: info.lastInsertRowid,
    });
  } catch (e) {
    console.error("[EduAI POST ai-analysis]", e?.message || e);
    const analysis = buildFallbackAnalysis({
      studentName: student.name,
      className: klass.name,
      subject: klass.subject,
      gradeRows,
    });

    const jsonStr = JSON.stringify(analysis);
    const info = db
      .prepare(
        `INSERT INTO learning_plans (student_id, plan_text, weeks, analysis_json)
         VALUES (?, ?, 4, ?)`
      )
      .run(studentId, analysis.plan4Weeks, jsonStr);

    res.status(201).json({
      analysis,
      learningPlanId: info.lastInsertRowid,
      fallback: true,
      warning:
        "AI teenus ei vastanud. Tagasiside loodi automaatselt hinnete põhjal.",
    });
  }
});

export default router;
