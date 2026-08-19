import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { generateMaterial } from "../services/materialGeneration.js";

const router = Router();

router.use(requireAuth);

function assertOwnClass(teacherId, classId) {
  return db
    .prepare(`SELECT id, name, subject FROM classes WHERE id = ? AND teacher_id = ?`)
    .get(classId, teacherId);
}

function buildFallbackMaterial({ type, topicName, className, subject }) {
  const baseTitle =
    type === "worksheet"
      ? `Tööleht: ${topicName}`
      : type === "test"
        ? `Kontrolltöö: ${topicName}`
        : `Tunnikava: ${topicName}`;

  const content =
    type === "worksheet"
      ? `Teema: ${topicName}
Klass: ${className}
Aine: ${subject}

1) Korda lühidalt teooriat teemal "${topicName}".
2) Lahenda 5 harjutust (lihtsast raskemani).
3) Selgita kahte lahenduskäiku oma sõnadega.
4) Lõpuülesanne: rakenda teemat praktilises näites.

Õpetaja märkus:
- Vajadusel jaga õpilased paaridesse.
- Arutle vigade üle klassiga koos.`
      : type === "test"
        ? `Teema: ${topicName}
Klass: ${className}
Aine: ${subject}

Kontrolltöö struktuur:
1) 5 lühiküsimust (teooria kontroll) - 25p
2) 3 keskmise raskusega ülesannet - 45p
3) 1 pikem probleemülesanne - 30p

Kokku: 100 punkti
Soovituslik aeg: 45 min`
        : `Teema: ${topicName}
Klass: ${className}
Aine: ${subject}

Tunni eesmärk:
- Õpilane mõistab teema "${topicName}" põhimõtteid.

Tunni käik:
1) Sissejuhatus (10 min)
2) Uus osa + näited (15 min)
3) Harjutamine (15 min)
4) Kokkuvõte ja refleksioon (5 min)

Kodune töö:
- 3 lühikest kordamisülesannet teemal "${topicName}".`;

  return { title: baseTitle, content };
}

router.get("/classes/:classId/materials", (req, res) => {
  const classId = Number(req.params.classId);
  if (!Number.isInteger(classId)) {
    return res.status(400).json({ error: "Kehtetu klassi ID." });
  }

  if (!assertOwnClass(req.teacherId, classId)) {
    return res.status(404).json({ error: "Klassi ei leitud." });
  }

  const rows = db
    .prepare(
      `SELECT id, class_id, type, title, content, created_at
       FROM materials
       WHERE class_id = ?
       ORDER BY datetime(created_at) DESC, id DESC`
    )
    .all(classId);

  res.json({ materials: rows });
});

router.post("/classes/:classId/materials/generate", async (req, res) => {
  const classId = Number(req.params.classId);
  if (!Number.isInteger(classId)) {
    return res.status(400).json({ error: "Kehtetu klassi ID." });
  }

  const klass = assertOwnClass(req.teacherId, classId);
  if (!klass) {
    return res.status(404).json({ error: "Klassi ei leitud." });
  }

  const {
    type,
    topicId,
    customTopicName,
    difficulty,
    durationMinutes,
    extraNotes,
  } = req.body || {};

  const allowedTypes = ["worksheet", "test", "lesson_plan"];
  if (!type || !allowedTypes.includes(type)) {
    return res.status(400).json({
      error: "Tüüp peab olema: worksheet, test või lesson_plan.",
    });
  }

  const customRaw =
    customTopicName != null && customTopicName !== ""
      ? String(customTopicName).trim().slice(0, 200)
      : "";

  let topicName;
  if (customRaw.length > 0) {
    topicName = customRaw;
  } else {
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
    topicName = topic.name;
  }

  const allowedDiff = ["light", "medium", "hard"];
  const diff = difficulty || "medium";
  if (!allowedDiff.includes(diff)) {
    return res.status(400).json({
      error: "Raskusaste peab olema: light, medium või hard.",
    });
  }

  let dur = null;
  if (durationMinutes != null && durationMinutes !== "") {
    dur = Number(durationMinutes);
    if (!Number.isInteger(dur) || dur < 15 || dur > 180) {
      return res.status(400).json({
        error: "Kestus peab olema täisarv 15–180 minutit (tunnikava puhul).",
      });
    }
  }

  const extra =
    extraNotes && String(extraNotes).trim()
      ? String(extraNotes).trim().slice(0, 2000)
      : null;

  try {
    const { title, content } = await generateMaterial(
      {
        type,
        className: klass.name,
        subject: klass.subject,
        topicName,
        difficulty: diff,
        durationMinutes: type === "lesson_plan" ? dur : null,
        extraNotes: extra,
      },
      req.user
    );

    const info = db
      .prepare(
        `INSERT INTO materials (class_id, type, title, content)
         VALUES (?, ?, ?, ?)`
      )
      .run(classId, type, title.slice(0, 500), content);

    const row = db
      .prepare(
        `SELECT id, class_id, type, title, content, created_at
         FROM materials WHERE id = ?`
      )
      .get(info.lastInsertRowid);

    res.status(201).json({ material: row });
  } catch (e) {
    console.error("[EduAI materjali genereerimine]", e?.message || e);
    const fallback = buildFallbackMaterial({
      type,
      topicName,
      className: klass.name,
      subject: klass.subject,
    });

    const info = db
      .prepare(
        `INSERT INTO materials (class_id, type, title, content)
         VALUES (?, ?, ?, ?)`
      )
      .run(classId, type, fallback.title.slice(0, 500), fallback.content);

    const row = db
      .prepare(
        `SELECT id, class_id, type, title, content, created_at
         FROM materials WHERE id = ?`
      )
      .get(info.lastInsertRowid);

    res.status(201).json({
      material: row,
      warning:
        "AI ei olnud hetkel saadaval, salvestasin automaatse šabloon-materjali.",
    });
  }
});

export default router;
