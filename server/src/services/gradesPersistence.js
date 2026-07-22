import { generateBatchGradeFeedback } from "./gradeFeedback.js";

/**
 * @param {import("better-sqlite3").Database} db
 * @param {object} opts
 * @param {number} opts.classId
 * @param {number} opts.topicId
 * @param {string} opts.date YYYY-MM-DD
 * @param {Array<{ studentId: number, score: number, notes?: string|null }>} opts.entries
 * @returns {Array<object>} Salvestatud grade read (SELECT * kujul)
 */
export function insertGradesInTransaction(db, { classId, topicId, date, entries }) {
  const studentIds = new Set(
    db
      .prepare(`SELECT id FROM students WHERE class_id = ?`)
      .all(classId)
      .map((r) => r.id)
  );

  const insert = db.prepare(
    `INSERT INTO grades (student_id, topic_id, score, date, notes)
     VALUES (?, ?, ?, ?, ?)`
  );

  const saved = [];

  db.transaction(() => {
    for (const e of entries) {
      const sid = Number(e.studentId);
      if (!Number.isInteger(sid) || !studentIds.has(sid)) {
        throw new Error("INVALID_STUDENT");
      }
      const score = Number(e.score);
      if (!Number.isInteger(score) || score < 0 || score > 110) {
        throw new Error("INVALID_SCORE");
      }
      const notes =
        e.notes && String(e.notes).trim()
          ? String(e.notes).trim().slice(0, 2000)
          : null;

      const info = insert.run(sid, topicId, score, date.trim(), notes);
      const row = db
        .prepare(
          `SELECT id, student_id, topic_id, score, date, notes, created_at, ai_feedback
           FROM grades WHERE id = ?`
        )
        .get(info.lastInsertRowid);
      saved.push(row);
    }
  })();

  return saved;
}

/**
 * @param {import("better-sqlite3").Database} db
 * @param {number} classId
 * @param {{ name: string }} topic
 * @param {string} date
 * @param {Array<object>} savedRows
 * @param {string|null} apiKey
 */
export async function attachBatchFeedbackToSaved(
  db,
  classId,
  topic,
  date,
  savedRows,
  apiKey
) {
  if (!apiKey || !String(apiKey).trim() || !savedRows.length) return;

  const klass = db
    .prepare(`SELECT name, subject FROM classes WHERE id = ?`)
    .get(classId);

  const idToName = Object.fromEntries(
    db
      .prepare(`SELECT id, name FROM students WHERE class_id = ?`)
      .all(classId)
      .map((s) => [s.id, s.name])
  );

  try {
    const feedbackList = await generateBatchGradeFeedback(
      {
        className: klass.name,
        subject: klass.subject,
        topicName: topic.name,
        date: date.trim(),
        entries: savedRows.map((r) => ({
          studentId: r.student_id,
          studentName: idToName[r.student_id] || "?",
          score: r.score,
          notes: r.notes,
        })),
      },
      apiKey
    );

    const updateFb = db.prepare(
      `UPDATE grades SET ai_feedback = ? WHERE id = ?`
    );
    for (const f of feedbackList) {
      const row = savedRows.find((s) => s.student_id === f.studentId);
      if (row) {
        updateFb.run(f.text, row.id);
        row.ai_feedback = f.text;
      }
    }
  } catch (e) {
    console.error("[EduAI] automaatne tagasiside", e?.message || e);
  }
}
