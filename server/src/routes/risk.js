import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { canAccessStudent } from "../services/access.js";
import { audit } from "../services/audit.js";
import {
  DEFAULT_THRESHOLDS,
  THRESHOLD_LIMITS,
  abcForStudent,
  cleanThresholds,
  getRiskThresholds,
} from "../services/abcRisk.js";

const router = Router();
router.use(requireAuth, requireStaff);

const VERDICTS = new Set(["was_risk", "not_risk"]);

function presentSettings(accountId) {
  const row = db
    .prepare(`SELECT 1 FROM risk_settings WHERE account_id = ?`)
    .get(accountId);
  return {
    thresholds: getRiskThresholds(db, accountId),
    defaults: DEFAULT_THRESHOLDS,
    limits: THRESHOLD_LIMITS,
    custom: Boolean(row),
  };
}

router.get("/settings", (req, res) => {
  res.json(presentSettings(req.user.id));
});

router.put("/settings", (req, res) => {
  const thresholds = cleanThresholds(req.body?.thresholds);
  db.prepare(
    `INSERT INTO risk_settings (account_id, config, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(account_id) DO UPDATE SET config = excluded.config, updated_at = excluded.updated_at`
  ).run(req.user.id, JSON.stringify(thresholds));
  audit(req, { action: "risk.settings_save", entityType: "risk_settings" });
  res.json(presentSettings(req.user.id));
});

router.delete("/settings", (req, res) => {
  db.prepare(`DELETE FROM risk_settings WHERE account_id = ?`).run(req.user.id);
  audit(req, { action: "risk.settings_reset", entityType: "risk_settings" });
  res.json(presentSettings(req.user.id));
});

/**
 * Õpetaja hinnang hoiatusele. Taseme ja põhjused loeb server ise praegusest
 * arvutusest (mitte kliendilt), et hilisem võrdlus oleks usaldusväärne.
 */
router.post("/feedback", (req, res) => {
  const studentId = Number(req.body?.studentId);
  const verdict = String(req.body?.verdict || "");
  if (!Number.isInteger(studentId) || !VERDICTS.has(verdict)) {
    return res.status(400).json({ error: "Vigane hinnang." });
  }
  if (!canAccessStudent(req.user, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }
  const note = String(req.body?.note || "").trim().slice(0, 500) || null;
  const abc = abcForStudent(db, studentId, getRiskThresholds(db, req.user.id));

  const info = db
    .prepare(
      `INSERT INTO risk_feedback (account_id, student_id, level, reasons, verdict, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, studentId, abc.level, JSON.stringify(abc.reasons), verdict, note);
  audit(req, {
    action: "risk.feedback",
    entityType: "risk_feedback",
    entityId: info.lastInsertRowid,
    studentId,
  });
  res.status(201).json({ id: info.lastInsertRowid, level: abc.level, verdict });
});

router.get("/feedback/student/:studentId", (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!Number.isInteger(studentId) || !canAccessStudent(req.user, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }
  const rows = db
    .prepare(
      `SELECT id, level, reasons, verdict, note, created_at
       FROM risk_feedback WHERE account_id = ? AND student_id = ?
       ORDER BY datetime(created_at) DESC, id DESC LIMIT 10`
    )
    .all(req.user.id, studentId);
  res.json({
    feedback: rows.map((r) => {
      let reasons = [];
      try { reasons = JSON.parse(r.reasons); } catch { reasons = []; }
      return {
        id: r.id,
        level: r.level,
        reasons,
        verdict: r.verdict,
        note: r.note,
        createdAt: r.created_at,
      };
    }),
  });
});

/** Kui täpsed on hoiatused: tase × hinnang, ainult selle õpetaja enda hinnangutest. */
router.get("/feedback/summary", (req, res) => {
  const rows = db
    .prepare(
      `SELECT level, verdict, COUNT(*) AS n
       FROM risk_feedback WHERE account_id = ? GROUP BY level, verdict`
    )
    .all(req.user.id);
  const byLevel = {};
  for (const r of rows) {
    byLevel[r.level] ??= { was_risk: 0, not_risk: 0 };
    byLevel[r.level][r.verdict] = r.n;
  }
  const flagged = ["red", "yellow"].reduce(
    (acc, lvl) => {
      acc.was_risk += byLevel[lvl]?.was_risk || 0;
      acc.not_risk += byLevel[lvl]?.not_risk || 0;
      return acc;
    },
    { was_risk: 0, not_risk: 0 }
  );
  const total = flagged.was_risk + flagged.not_risk;
  res.json({
    byLevel,
    flagged,
    /** Hoiatuste täpsus: kui suure osa punastest/kollastest õpetaja kinnitas. */
    precision: total ? Math.round((flagged.was_risk / total) * 100) : null,
    total,
  });
});

export default router;
