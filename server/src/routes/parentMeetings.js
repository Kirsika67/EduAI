import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { visibleClassIds, linkedStudentsForParent } from "../services/access.js";
import { ROLES } from "../constants/roles.js";

const router = Router();
router.use(requireAuth);

/**
 * Lapsevanema päeva ajapesad.
 *
 * Privaatsus: vanem näeb vabu pesi ja OMA broneeringut nimeliselt, teiste omi
 * ainult märkega "Broneeritud". Juhend ütles "broneeritud hallid oma nimega" —
 * teiste vanemate nimede näitamine oleks aga tarbetu isikuandmete jagamine
 * lapsevanemate vahel, seega näeb nimesid ainult õpetaja.
 */

function slotVisibleToUser(user, slot) {
  if (user.role === ROLES.PARENT) return true;
  return visibleClassIds(user).includes(Number(slot.class_id));
}

router.get("/", (req, res) => {
  const from = String(req.query.from || "").slice(0, 10);
  const to = String(req.query.to || "").slice(0, 10);
  const hasRange = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to);

  const isParent = req.user.role === ROLES.PARENT;
  const params = [];
  const filters = [];

  if (isParent) {
    /** Vanem näeb ainult oma lapse klassi õpetajate pesi. */
    const classIds = visibleClassIds(req.user);
    if (!classIds.length) return res.json({ slots: [] });
    filters.push(`s.class_id IN (${classIds.map(() => "?").join(", ")})`);
    params.push(...classIds);
  } else {
    const classIds = visibleClassIds(req.user);
    if (!classIds.length) return res.json({ slots: [] });
    filters.push(
      `(s.teacher_id = ? OR s.class_id IN (${classIds.map(() => "?").join(", ")}))`
    );
    params.push(req.user.id, ...classIds);
  }

  if (hasRange) {
    filters.push(`s.date BETWEEN ? AND ?`);
    params.push(from, to);
  }

  const rows = db
    .prepare(
      `SELECT s.id, s.date, s.start_time, s.duration_minutes, s.class_id,
              s.teacher_id, s.booked_by, s.booked_student_id, s.booked_at,
              t.name AS teacher_name, c.name AS class_name,
              p.name AS booked_by_name, st.name AS student_name
       FROM parent_meeting_slots s
       JOIN teachers t ON t.id = s.teacher_id
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN teachers p ON p.id = s.booked_by
       LEFT JOIN students st ON st.id = s.booked_student_id
       WHERE ${filters.join(" AND ")}
       ORDER BY s.date, s.start_time`
    )
    .all(...params);

  res.json({
    slots: rows.map((r) => {
      const mine = Number(r.booked_by) === Number(req.user.id);
      const showNames = !isParent || mine;
      return {
        id: r.id,
        date: r.date,
        startTime: r.start_time,
        durationMinutes: r.duration_minutes,
        className: r.class_name,
        teacherName: r.teacher_name,
        booked: Boolean(r.booked_by),
        bookedByMe: mine,
        bookedByName: showNames ? r.booked_by_name : null,
        studentName: showNames ? r.student_name : null,
      };
    }),
  });
});

/** Õpetaja loob pesad. `count` > 1 loob järjestikused pesad ühe kutsega. */
router.post("/slots", requireStaff, (req, res) => {
  const date = String(req.body?.date || "").slice(0, 10);
  const startTime = String(req.body?.startTime || "").slice(0, 5);
  const duration = Number(req.body?.durationMinutes) || 15;
  const count = Math.min(Math.max(Number(req.body?.count) || 1, 1), 40);
  const classId = req.body?.classId ? Number(req.body.classId) : null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Vali kuupäev." });
  }
  if (!/^\d{2}:\d{2}$/.test(startTime)) {
    return res.status(400).json({ error: "Vali algusaeg kujul 14:00." });
  }
  if (duration < 5 || duration > 120) {
    return res.status(400).json({ error: "Kestus peab olema 5-120 minutit." });
  }
  if (classId !== null && !visibleClassIds(req.user).includes(classId)) {
    return res.status(404).json({ error: "Klassi ei leitud." });
  }

  const [h, m] = startTime.split(":").map(Number);
  const insert = db.prepare(
    `INSERT OR IGNORE INTO parent_meeting_slots
       (teacher_id, class_id, date, start_time, duration_minutes)
     VALUES (?, ?, ?, ?, ?)`
  );

  let created = 0;
  db.transaction(() => {
    for (let i = 0; i < count; i++) {
      const total = h * 60 + m + i * duration;
      if (total >= 24 * 60) break;
      const time = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
        total % 60
      ).padStart(2, "0")}`;
      const info = insert.run(req.user.id, classId, date, time, duration);
      if (info.changes) created += 1;
    }
  })();

  audit(req, { action: "parent_meeting.slots_create", entityType: "parent_meeting_slot" });
  res.status(201).json({ created });
});

router.delete("/slots/:id", requireStaff, (req, res) => {
  const id = Number(req.params.id);
  const slot = db.prepare(`SELECT * FROM parent_meeting_slots WHERE id = ?`).get(id);
  if (!slot || Number(slot.teacher_id) !== Number(req.user.id)) {
    return res.status(404).json({ error: "Ajapesa ei leitud." });
  }
  if (slot.booked_by) {
    return res
      .status(409)
      .json({ error: "See aeg on broneeritud — tühista broneering enne kustutamist." });
  }
  db.prepare(`DELETE FROM parent_meeting_slots WHERE id = ?`).run(id);
  res.json({ ok: true });
});

/** Vanem broneerib. Tingimuslik UPDATE hoiab ära kaks samaaegset broneeringut. */
router.post("/slots/:id/book", (req, res) => {
  if (req.user.role !== ROLES.PARENT) {
    return res.status(403).json({ error: "Aega saab broneerida lapsevanem." });
  }
  const id = Number(req.params.id);
  const slot = db.prepare(`SELECT * FROM parent_meeting_slots WHERE id = ?`).get(id);
  if (!slot || !slotVisibleToUser(req.user, slot)) {
    return res.status(404).json({ error: "Ajapesa ei leitud." });
  }

  const children = linkedStudentsForParent(req.user.id);
  if (!children.length) {
    return res.status(400).json({ error: "Sinu kontoga pole last seotud." });
  }
  const studentId = req.body?.studentId
    ? Number(req.body.studentId)
    : Number(children[0].id);
  if (!children.some((c) => Number(c.id) === studentId)) {
    return res.status(403).json({ error: "See laps pole sinuga seotud." });
  }

  const claimed = db
    .prepare(
      `UPDATE parent_meeting_slots
       SET booked_by = ?, booked_student_id = ?, booked_at = datetime('now')
       WHERE id = ? AND booked_by IS NULL`
    )
    .run(req.user.id, studentId, id);

  if (claimed.changes !== 1) {
    return res.status(409).json({ error: "See aeg broneeriti just ära. Vali teine." });
  }

  audit(req, {
    action: "parent_meeting.book",
    entityType: "parent_meeting_slot",
    entityId: id,
    studentId,
  });
  res.status(201).json({ ok: true });
});

/** Broneeringu tühistamine — vanem enda oma, õpetaja enda pesa oma. */
router.delete("/slots/:id/book", (req, res) => {
  const id = Number(req.params.id);
  const slot = db.prepare(`SELECT * FROM parent_meeting_slots WHERE id = ?`).get(id);
  if (!slot) return res.status(404).json({ error: "Ajapesa ei leitud." });

  const isOwnBooking = Number(slot.booked_by) === Number(req.user.id);
  const isSlotOwner = Number(slot.teacher_id) === Number(req.user.id);
  if (!isOwnBooking && !isSlotOwner) {
    return res.status(403).json({ error: "Sul pole selleks õigust." });
  }

  db.prepare(
    `UPDATE parent_meeting_slots
     SET booked_by = NULL, booked_student_id = NULL, booked_at = NULL
     WHERE id = ?`
  ).run(id);

  audit(req, {
    action: "parent_meeting.cancel",
    entityType: "parent_meeting_slot",
    entityId: id,
    studentId: slot.booked_student_id,
  });
  res.json({ ok: true });
});

export default router;
