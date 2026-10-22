import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { AUTOMATION_TYPES, runAutomation } from "../services/automations.js";

const router = Router();
router.use(requireAuth, requireStaff);

const MAX_AUTOMATIONS = 20;

function cleanConfig(type, raw = {}) {
  const defaults = AUTOMATION_TYPES[type].defaults;
  const cfg = { ...defaults };
  if (type === "grade_drop") cfg.threshold = Math.min(95, Math.max(10, Number(raw.threshold) || defaults.threshold));
  if (type === "deadline_reminder") {
    cfg.daysBefore = [1, 2, 3, 7].includes(Number(raw.daysBefore)) ? Number(raw.daysBefore) : defaults.daysBefore;
    cfg.announce = raw.announce === true;
  }
  if (type === "weekly_summary") cfg.weekday = Math.min(7, Math.max(1, Number(raw.weekday) || defaults.weekday));
  if (type === "no_grades") cfg.days = Math.min(90, Math.max(3, Number(raw.days) || defaults.days));
  return cfg;
}

function ownClassId(req, res) {
  if (req.body?.classId === null || req.body?.classId === "" || req.body?.classId === undefined) return null;
  const id = Number(req.body.classId);
  const cls = db.prepare(`SELECT id FROM classes WHERE id = ? AND teacher_id = ?`).get(id, req.user.id);
  if (!cls) { res.status(404).json({ error: "Klassi ei leitud." }); return undefined; }
  return cls.id;
}

function present(row) {
  let config = {};
  try { config = JSON.parse(row.config); } catch { config = {}; }
  return {
    id: row.id,
    type: row.type,
    label: AUTOMATION_TYPES[row.type]?.label || row.type,
    classId: row.class_id,
    className: row.class_name || null,
    config,
    enabled: Boolean(row.enabled),
    lastRunAt: row.last_run_at,
  };
}

router.get("/types", (_req, res) => {
  res.json({ types: Object.entries(AUTOMATION_TYPES).map(([value, t]) => ({ value, label: t.label, description: t.description, defaults: t.defaults })) });
});

router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.*, c.name AS class_name FROM automations a LEFT JOIN classes c ON c.id = a.class_id
       WHERE a.account_id = ? ORDER BY a.id DESC`
    )
    .all(req.user.id);
  res.json({ automations: rows.map(present) });
});

router.post("/", (req, res) => {
  const type = String(req.body?.type || "");
  if (!AUTOMATION_TYPES[type]) return res.status(400).json({ error: "Vali automatsiooni tüüp." });
  const count = db.prepare(`SELECT COUNT(*) AS n FROM automations WHERE account_id = ?`).get(req.user.id).n;
  if (count >= MAX_AUTOMATIONS) return res.status(400).json({ error: `Automatsioone võib olla kuni ${MAX_AUTOMATIONS}.` });
  const classId = ownClassId(req, res);
  if (classId === undefined) return;
  const info = db
    .prepare(`INSERT INTO automations (account_id, class_id, type, config) VALUES (?, ?, ?, ?)`)
    .run(req.user.id, classId, type, JSON.stringify(cleanConfig(type, req.body?.config)));
  audit(req, { action: "automation.create", entityType: "automation", entityId: info.lastInsertRowid });
  res.status(201).json({ id: info.lastInsertRowid });
});

function own(req) {
  return db.prepare(`SELECT * FROM automations WHERE id = ? AND account_id = ?`).get(Number(req.params.id), req.user.id);
}

router.patch("/:id", (req, res) => {
  const a = own(req);
  if (!a) return res.status(404).json({ error: "Automatsiooni ei leitud." });
  if (req.body?.enabled !== undefined) {
    db.prepare(`UPDATE automations SET enabled = ? WHERE id = ?`).run(req.body.enabled ? 1 : 0, a.id);
  }
  if (req.body?.config) {
    db.prepare(`UPDATE automations SET config = ? WHERE id = ?`).run(JSON.stringify(cleanConfig(a.type, req.body.config)), a.id);
  }
  res.json({ ok: true });
});

router.delete("/:id", (req, res) => {
  const a = own(req);
  if (!a) return res.status(404).json({ error: "Automatsiooni ei leitud." });
  db.prepare(`DELETE FROM automations WHERE id = ?`).run(a.id);
  audit(req, { action: "automation.delete", entityType: "automation", entityId: a.id });
  res.json({ ok: true });
});

/** "Käivita nüüd": proovi reeglit kohe (ignoreerib kellaaega ja kordusi). */
router.post("/:id/run", async (req, res) => {
  const a = own(req);
  if (!a) return res.status(404).json({ error: "Automatsiooni ei leitud." });
  const created = await runAutomation(a, { force: true });
  res.json({ created });
});

export default router;

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
  const rows = db
    .prepare(`SELECT id, title, body, link, created_at, read_at FROM notifications WHERE account_id = ? ORDER BY id DESC LIMIT ?`)
    .all(req.user.id, limit);
  const unread = db.prepare(`SELECT COUNT(*) AS n FROM notifications WHERE account_id = ? AND read_at IS NULL`).get(req.user.id).n;
  res.json({
    unread,
    notifications: rows.map((r) => ({ id: r.id, title: r.title, body: r.body, link: r.link, createdAt: r.created_at, read: Boolean(r.read_at) })),
  });
});

notificationsRouter.post("/read-all", (req, res) => {
  db.prepare(`UPDATE notifications SET read_at = datetime('now') WHERE account_id = ? AND read_at IS NULL`).run(req.user.id);
  res.json({ ok: true });
});

notificationsRouter.delete("/", (req, res) => {
  db.prepare(`DELETE FROM notifications WHERE account_id = ?`).run(req.user.id);
  res.json({ ok: true });
});
