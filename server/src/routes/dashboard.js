import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { classTopicWeakAlerts } from "../services/alerts.js";
import { abcForStudent } from "../services/abcRisk.js";
import { generateDashboardSummary } from "../services/aiOverview.js";

const router = Router();
router.use(requireAuth);

router.get("/overview", async (req, res) => {
  const classIdParam = req.query.classId;

  const classes = db
    .prepare(
      `SELECT c.id, c.name, c.subject,
        (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) AS student_count
       FROM classes c
       WHERE c.teacher_id = ?
       ORDER BY c.name COLLATE NOCASE`
    )
    .all(req.teacherId);

  let scopeClass = null;

  if (classIdParam !== undefined && classIdParam !== "") {
    const id = Number(classIdParam);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Kehtetu klassi ID." });
    }
    scopeClass = classes.find((c) => c.id === id) || null;
    if (!scopeClass) {
      return res.status(404).json({ error: "Klassi ei leitud." });
    }
  } else if (classes.length) {
    scopeClass = classes[0];
  }

  const totalStudentsTracked = scopeClass
    ? scopeClass.student_count || 0
    : classes.reduce((acc, c) => acc + (c.student_count || 0), 0);

  if (!scopeClass) {
    return res.json({
      scope: null,
      metrics: {
        totalStudentsTracked,
        needAttentionCount: 0,
        classAveragePercent: null,
        ungradedWorkCount: 0,
      },
      studentAlerts: [],
      classTopicAlerts: [],
      aiSummary: null,
      aiSummaryFallback:
        "Loo klass ja lisa õpilased ning hinded, et näha ülevaadet.",
    });
  }

  const cid = scopeClass.id;

  const classAvgRow = db
    .prepare(
      `SELECT AVG(g.score) AS avg_score
       FROM grades g
       JOIN students s ON s.id = g.student_id
       WHERE s.class_id = ?`
    )
    .get(cid);

  const classAveragePercent =
    classAvgRow?.avg_score != null
      ? Math.round(Number(classAvgRow.avg_score) * 10) / 10
      : null;

  const ungradedRow = db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM students s
       CROSS JOIN topics t ON t.class_id = s.class_id
       LEFT JOIN grades g ON g.student_id = s.id AND g.topic_id = t.id
       WHERE s.class_id = ? AND g.id IS NULL`
    )
    .get(cid);

  const ungradedWorkCount = ungradedRow?.n ?? 0;

  const topicAvgRows = db
    .prepare(
      `SELECT t.id AS topic_id, t.name AS topic_name, AVG(g.score) AS avg_score
       FROM topics t
       JOIN grades g ON g.topic_id = t.id
       JOIN students s ON s.id = g.student_id AND s.class_id = t.class_id
       WHERE t.class_id = ?
       GROUP BY t.id
       HAVING COUNT(g.id) > 0`
    )
    .all(cid);

  const classTopicAlerts = classTopicWeakAlerts(
    topicAvgRows.map((r) => ({
      topic_id: r.topic_id,
      topic_name: r.topic_name,
      avg_score: Number(r.avg_score),
    }))
  );

  const students = db
    .prepare(
      `SELECT id, name FROM students WHERE class_id = ? ORDER BY name COLLATE NOCASE`
    )
    .all(cid);

  const studentAlerts = [];
  let needAttentionCount = 0;

  for (const st of students) {
    const abc = abcForStudent(db, st.id);
    if (abc.level === "red" || abc.level === "yellow") {
      needAttentionCount += 1;
    }
    if (abc.level === "blue") continue;

    studentAlerts.push({
      level: abc.level === "yellow" ? "amber" : abc.level,
      kind: "student",
      studentId: st.id,
      studentName: st.name,
      message: abc.label,
      detail: abc.reasons.join(" · ") || abc.label,
      reasons: abc.reasons,
      score: abc.score,
      components: abc.components,
    });
  }

  const severity = { red: 0, amber: 1, green: 2 };
  studentAlerts.sort(
    (a, b) => severity[a.level] - severity[b.level] || a.studentName.localeCompare(b.studentName, "et")
  );

  const alertSummary = [
    ...studentAlerts.map(
      (a) => `${a.studentName}: ${a.message}`
    ),
    ...classTopicAlerts.map(
      (a) => `Teema ${a.topicName}: ${a.message} (${a.averagePercent}%)`
    ),
  ].join("; ");

  let aiSummary = null;
  let aiSummaryFallback = null;

  try {
    /**
     * Võtme käsitlus on `aiEngine` sees. Varasem versioon logis siin võtme
     * pikkuse ja esimesed märgid — saladuse jälgi ei kuulu logisse, ka
     * silumise ajal mitte.
     */
    const ai = await generateDashboardSummary(
      {
        className: scopeClass.name,
        subject: scopeClass.subject,
        metrics: {
          totalStudentsTracked,
          needAttentionCount,
          classAveragePercent,
          ungradedWorkCount,
        },
        alertSummary:
          alertSummary ||
          "Ühtegi automaatset hoiatust ei leitud või pole piisavalt andmeid.",
        topicAvgs: topicAvgRows.map((r) => ({
          topic: r.topic_name,
          average: Math.round(Number(r.avg_score) * 10) / 10,
        })),
        /**
         * Hoiatuste kokkuvõttes on õpilaste nimed. Anna need mootorile ette,
         * et need asendataks märgistega enne Anthropicule saatmist — muidu
         * läheks siit korraga välja kõigi tähelepanu vajavate laste nimed.
         */
        studentNames: studentAlerts.map((a) => a.studentName),
      },
      req.user
    );
    aiSummary = ai.text;
    aiSummaryFallback = ai.fallback;
  } catch (e) {
    console.error("[EduAI AI ülevaade]", e?.message || e);
    aiSummaryFallback =
      "AI ülevaadet ei saanud praegu laadida. Kontrolli ANTHROPIC_API_KEY või proovi hiljem uuesti.";
  }

  res.json({
    scope: {
      classId: cid,
      className: scopeClass.name,
      subject: scopeClass.subject,
    },
    metrics: {
      totalStudentsTracked,
      needAttentionCount,
      classAveragePercent,
      ungradedWorkCount,
    },
    studentAlerts,
    classTopicAlerts,
    aiSummary,
    aiSummaryFallback,
  });
});

export default router;
