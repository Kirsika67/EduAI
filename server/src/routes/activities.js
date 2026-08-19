import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { canAccessStudent, linkedStudentsForParent } from "../services/access.js";
import { ROLES, isStaff } from "../constants/roles.js";

const router = Router();
router.use(requireAuth);

/**
 * Huviringid.
 *
 * Privaatsus: koolitöötaja näeb osalejate nimesid, pere näeb osalejate ARVU ja
 * oma lapsi. Sama põhimõte nagu lapsevanema päeval — ring on kooli tegevus,
 * mitte avalik nimekiri sellest, kelle laps mida teeb.
 */

function familyStudents(user) {
  if (user.role === ROLES.PARENT) return linkedStudentsForParent(user.id);
  if (user.role === ROLES.STUDENT && user.linkedStudentId) {
    const own = db
      .prepare(`SELECT id, name FROM students WHERE id = ?`)
      .get(user.linkedStudentId);
    return own ? [own] : [];
  }
  return [];
}

router.get("/", (req, res) => {
  if (req.user.schoolId == null) return res.json({ activities: [] });

  const rows = db
    .prepare(
      `SELECT a.*, t.name AS leader_name,
              (SELECT COUNT(*) FROM activity_participants p WHERE p.activity_id = a.id) AS participant_count
       FROM activities a
       LEFT JOIN teachers t ON t.id = a.leader_id
       WHERE a.school_id = ?
       ORDER BY a.is_open DESC, a.name COLLATE NOCASE`
    )
    .all(req.user.schoolId);

  const staff = isStaff(req.user.role);
  const mine = familyStudents(req.user).map((s) => Number(s.id));

  const participantsOf = db.prepare(
    `SELECT p.student_id, s.name AS student_name, c.name AS class_name
     FROM activity_participants p
     JOIN students s ON s.id = p.student_id
     LEFT JOIN classes c ON c.id = s.class_id
     WHERE p.activity_id = ?
     ORDER BY s.name COLLATE NOCASE`
  );

  res.json({
    activities: rows.map((a) => {
      const participants = participantsOf.all(a.id);
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        leaderName: a.leader_name,
        dayOfWeek: a.day_of_week,
        startTime: a.start_time,
        location: a.location,
        maxParticipants: a.max_participants,
        isOpen: Boolean(a.is_open),
        participantCount: participants.length,
        isFull:
          a.max_participants != null && participants.length >= a.max_participants,
        /** Nimekiri ainult koolitöötajale; perele oma lapsed. */
        participants: staff
          ? participants.map((p) => ({
              studentId: p.student_id,
              studentName: p.student_name,
              className: p.class_name,
            }))
          : participants
              .filter((p) => mine.includes(Number(p.student_id)))
              .map((p) => ({
                studentId: p.student_id,
                studentName: p.student_name,
                className: p.class_name,
              })),
        myStudents: participants
          .filter((p) => mine.includes(Number(p.student_id)))
          .map((p) => Number(p.student_id)),
      };
    }),
    myStudents: familyStudents(req.user).map((s) => ({ id: s.id, name: s.name })),
  });
});

router.post("/", requireStaff, (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (name.length < 2) return res.status(400).json({ error: "Sisesta ringi nimi." });
  if (req.user.schoolId == null) {
    return res.status(400).json({ error: "Sinu konto pole kooliga seotud." });
  }

  const dayOfWeek = req.body?.dayOfWeek ? Number(req.body.dayOfWeek) : null;
  if (dayOfWeek !== null && (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7)) {
    return res.status(400).json({ error: "Vali kehtiv nädalapäev." });
  }
  const max = req.body?.maxParticipants ? Number(req.body.maxParticipants) : null;
  if (max !== null && (!Number.isInteger(max) || max < 1 || max > 500)) {
    return res.status(400).json({ error: "Kohtade arv peab olema 1-500." });
  }

  const info = db
    .prepare(
      `INSERT INTO activities
         (school_id, name, description, leader_id, day_of_week, start_time, location, max_participants)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user.schoolId,
      name.slice(0, 120),
      req.body?.description ? String(req.body.description).slice(0, 600) : null,
      req.user.id,
      dayOfWeek,
      req.body?.startTime ? String(req.body.startTime).slice(0, 5) : null,
      req.body?.location ? String(req.body.location).slice(0, 80) : null,
      max
    );

  audit(req, { action: "activity.create", entityType: "activity", entityId: info.lastInsertRowid });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.patch("/:id", requireStaff, (req, res) => {
  const id = Number(req.params.id);
  const activity = db.prepare(`SELECT * FROM activities WHERE id = ?`).get(id);
  if (!activity || Number(activity.school_id) !== Number(req.user.schoolId)) {
    return res.status(404).json({ error: "Ringi ei leitud." });
  }
  if (req.body?.isOpen === undefined) {
    return res.status(400).json({ error: "Midagi ei muudetud." });
  }
  db.prepare(`UPDATE activities SET is_open = ? WHERE id = ?`).run(
    req.body.isOpen ? 1 : 0,
    id
  );
  res.json({ ok: true });
});

router.delete("/:id", requireStaff, (req, res) => {
  const id = Number(req.params.id);
  const activity = db.prepare(`SELECT * FROM activities WHERE id = ?`).get(id);
  if (!activity || Number(activity.school_id) !== Number(req.user.schoolId)) {
    return res.status(404).json({ error: "Ringi ei leitud." });
  }
  db.prepare(`DELETE FROM activities WHERE id = ?`).run(id);
  audit(req, { action: "activity.delete", entityType: "activity", entityId: id });
  res.json({ ok: true });
});

/**
 * Ringi registreerumine.
 *
 * Kohtade piirang kontrollitakse transaktsiooni sees ja uuesti pärast lisamist:
 * SQLite ei oska "mitte üle N rea" piirangut, seega kaks samaaegset
 * registreerumist võiksid muidu mõlemad läbi minna. Kui pärast lisamist on
 * ridu üle piiri, võetakse oma rida tagasi.
 */
router.post("/:id/participants", (req, res) => {
  const id = Number(req.params.id);
  const activity = db.prepare(`SELECT * FROM activities WHERE id = ?`).get(id);
  if (!activity || Number(activity.school_id) !== Number(req.user.schoolId)) {
    return res.status(404).json({ error: "Ringi ei leitud." });
  }
  if (!activity.is_open && !isStaff(req.user.role)) {
    return res.status(409).json({ error: "Registreerimine on suletud." });
  }

  const studentId = Number(req.body?.studentId);
  if (!Number.isInteger(studentId) || !canAccessStudent(req.user, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }
  /** Pere tohib registreerida ainult oma lapse; õpetaja oma klassi õpilase. */
  if (!isStaff(req.user.role)) {
    const mine = familyStudents(req.user).map((s) => Number(s.id));
    if (!mine.includes(studentId)) {
      return res.status(403).json({ error: "Saad registreerida ainult oma lapse." });
    }
  }

  let result = { ok: false, error: "Registreerimine ebaõnnestus." };
  db.transaction(() => {
    const existing = db
      .prepare(
        `SELECT 1 FROM activity_participants WHERE activity_id = ? AND student_id = ?`
      )
      .get(id, studentId);
    if (existing) {
      result = { ok: true, already: true };
      return;
    }

    db.prepare(
      `INSERT INTO activity_participants (activity_id, student_id, added_by) VALUES (?, ?, ?)`
    ).run(id, studentId, req.user.id);

    if (activity.max_participants != null) {
      const count = db
        .prepare(`SELECT COUNT(*) AS n FROM activity_participants WHERE activity_id = ?`)
        .get(id).n;
      if (count > activity.max_participants) {
        db.prepare(
          `DELETE FROM activity_participants WHERE activity_id = ? AND student_id = ?`
        ).run(id, studentId);
        result = { ok: false, error: "Ring sai just täis. Vali teine ring." };
        return;
      }
    }
    result = { ok: true };
  })();

  if (!result.ok) return res.status(409).json({ error: result.error });

  audit(req, {
    action: "activity.join",
    entityType: "activity",
    entityId: id,
    studentId,
  });
  res.status(201).json({ ok: true });
});

router.delete("/:id/participants/:studentId", (req, res) => {
  const id = Number(req.params.id);
  const studentId = Number(req.params.studentId);
  const activity = db.prepare(`SELECT * FROM activities WHERE id = ?`).get(id);
  if (!activity || Number(activity.school_id) !== Number(req.user.schoolId)) {
    return res.status(404).json({ error: "Ringi ei leitud." });
  }
  if (!canAccessStudent(req.user, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }
  if (!isStaff(req.user.role)) {
    const mine = familyStudents(req.user).map((s) => Number(s.id));
    if (!mine.includes(studentId)) {
      return res.status(403).json({ error: "Saad muuta ainult oma lapse registreeringut." });
    }
  }

  db.prepare(
    `DELETE FROM activity_participants WHERE activity_id = ? AND student_id = ?`
  ).run(id, studentId);

  audit(req, {
    action: "activity.leave",
    entityType: "activity",
    entityId: id,
    studentId,
  });
  res.json({ ok: true });
});

/** Ühe õpilase ringid — õpilase profiilile ja pere vaatele. */
router.get("/student/:studentId", (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!Number.isInteger(studentId) || !canAccessStudent(req.user, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }
  const rows = db
    .prepare(
      `SELECT a.id, a.name, a.day_of_week, a.start_time, a.location, t.name AS leader_name
       FROM activity_participants p
       JOIN activities a ON a.id = p.activity_id
       LEFT JOIN teachers t ON t.id = a.leader_id
       WHERE p.student_id = ?
       ORDER BY a.name COLLATE NOCASE`
    )
    .all(studentId);

  res.json({
    activities: rows.map((a) => ({
      id: a.id,
      name: a.name,
      dayOfWeek: a.day_of_week,
      startTime: a.start_time,
      location: a.location,
      leaderName: a.leader_name,
    })),
  });
});

export default router;
