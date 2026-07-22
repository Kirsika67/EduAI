import { Router } from "express";
import multer from "multer";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import {
  insertGradesInTransaction,
  attachBatchFeedbackToSaved,
} from "../services/gradesPersistence.js";
import {
  parseGradeSpreadsheet,
  mapImportRowsToEntries,
} from "../services/gradeImport.js";

const router = Router();

router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

function assertOwnClass(teacherId, classId) {
  return db
    .prepare(`SELECT id FROM classes WHERE id = ? AND teacher_id = ?`)
    .get(classId, teacherId);
}

router.post("/classes/:classId/grades", async (req, res) => {
  const classId = Number(req.params.classId);
  if (!Number.isInteger(classId)) {
    return res.status(400).json({ error: "Kehtetu klassi ID." });
  }

  if (!assertOwnClass(req.teacherId, classId)) {
    return res.status(404).json({ error: "Klassi ei leitud." });
  }

  const { topicId, date, entries } = req.body || {};
  const tid = Number(topicId);
  if (!Number.isInteger(tid)) {
    return res.status(400).json({ error: "Teema on kohustuslik." });
  }

  const topic = db
    .prepare(`SELECT id, name FROM topics WHERE id = ? AND class_id = ?`)
    .get(tid, classId);
  if (!topic) {
    return res.status(400).json({ error: "Teema ei kuulu sellesse klassi." });
  }

  if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return res.status(400).json({
      error: "Kuupäev peab olema kujul YYYY-MM-DD.",
    });
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: "Lisa vähemalt üks hinne." });
  }

  let saved;
  try {
    saved = insertGradesInTransaction(db, {
      classId,
      topicId: tid,
      date: date.trim(),
      entries: entries.map((e) => ({
        studentId: e.studentId,
        score: e.score,
        notes: e.notes,
      })),
    });
  } catch (err) {
    if (err.message === "INVALID_STUDENT") {
      return res.status(400).json({ error: "Mõne õpilase ID on kehtetu." });
    }
    if (err.message === "INVALID_SCORE") {
      return res
        .status(400)
        .json({ error: "Hinne peab olema täisarv 0–110 (lisaülesanded lubatud)." });
    }
    throw err;
  }

  await attachBatchFeedbackToSaved(
    db,
    classId,
    topic,
    date,
    saved,
    process.env.ANTHROPIC_API_KEY
  );

  res.status(201).json({ grades: saved });
});

/**
 * Impordib hindeid CSV või Excel (.xlsx, .xls) failist.
 * Vormiväljad: topicId, date; fail: file
 */
router.post(
  "/classes/:classId/grades/import",
  upload.single("file"),
  async (req, res) => {
    const classId = Number(req.params.classId);
    if (!Number.isInteger(classId)) {
      return res.status(400).json({ error: "Kehtetu klassi ID." });
    }

    if (!assertOwnClass(req.teacherId, classId)) {
      return res.status(404).json({ error: "Klassi ei leitud." });
    }

    const tid = Number(req.body?.topicId);
    const date = req.body?.date;
    if (!Number.isInteger(tid)) {
      return res.status(400).json({ error: "Teema on kohustuslik." });
    }

    const topic = db
      .prepare(`SELECT id, name FROM topics WHERE id = ? AND class_id = ?`)
      .get(tid, classId);
    if (!topic) {
      return res.status(400).json({ error: "Teema ei kuulu sellesse klassi." });
    }

    if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      return res.status(400).json({
        error: "Kuupäev peab olema kujul YYYY-MM-DD.",
      });
    }

    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ error: "Laadi üles CSV või Excel fail." });
    }

    const extOk = /\.(csv|txt|xlsx|xls)$/i.test(file.originalname || "");
    if (!extOk) {
      return res.status(400).json({
        error: "Lubatud on .csv, .txt, .xlsx või .xls.",
      });
    }

    let rawRows;
    try {
      rawRows = parseGradeSpreadsheet(file.buffer, file.originalname || "");
    } catch (e) {
      return res.status(400).json({
        error:
          e?.message && typeof e.message === "string"
            ? e.message
            : "Faili lugemine ebaõnnestus.",
      });
    }

    const students = db
      .prepare(`SELECT id, name FROM students WHERE class_id = ? ORDER BY name`)
      .all(classId);

    const { entries, warnings, skipped } = mapImportRowsToEntries(
      rawRows,
      students,
      2
    );

    if (!entries.length) {
      return res.status(400).json({
        error: "Ühtegi kehtivat rida ei leitud. Kontrolli veerge „nimi“ ja „hinne“ (või „id“ ja „hinne“).",
        skipped,
        warnings,
      });
    }

    let saved;
    try {
      saved = insertGradesInTransaction(db, {
        classId,
        topicId: tid,
        date: date.trim(),
        entries,
      });
    } catch (err) {
      if (err.message === "INVALID_STUDENT") {
        return res.status(400).json({ error: "Mõne õpilase ID on kehtetu." });
      }
      if (err.message === "INVALID_SCORE") {
        return res
          .status(400)
          .json({ error: "Hinne peab olema täisarv 0–110 (lisaülesanded lubatud)." });
      }
      throw err;
    }

    await attachBatchFeedbackToSaved(
      db,
      classId,
      topic,
      date,
      saved,
      process.env.ANTHROPIC_API_KEY
    );

    res.status(201).json({
      imported: saved.length,
      grades: saved,
      skipped,
      warnings,
    });
  }
);

router.get("/classes/:classId/grades", (req, res) => {
  const classId = Number(req.params.classId);
  if (!Number.isInteger(classId)) {
    return res.status(400).json({ error: "Kehtetu klassi ID." });
  }

  if (!assertOwnClass(req.teacherId, classId)) {
    return res.status(404).json({ error: "Klassi ei leitud." });
  }

  const rows = db
    .prepare(
      `SELECT g.id, g.student_id, g.topic_id, g.score, g.date, g.notes, g.created_at, g.ai_feedback,
              s.name AS student_name, t.name AS topic_name
       FROM grades g
       JOIN students s ON s.id = g.student_id
       JOIN topics t ON t.id = g.topic_id
       WHERE s.class_id = ?
       ORDER BY g.date DESC, g.id DESC`
    )
    .all(classId);

  res.json({ grades: rows });
});

export default router;
