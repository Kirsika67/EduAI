import { Router } from "express";
import bcrypt from "bcrypt";
import db from "../db.js";
import { requireAuth, requireRole, requireStaff } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { canAccessStudent } from "../services/access.js";
import { newInviteToken, hashToken } from "../utils/codes.js";
import { signToken } from "../utils/jwt.js";
import { accountPayload } from "./auth.js";
import { ROLES, CAN_INVITE_ROLES, INVITE_ONLY_ROLES } from "../constants/roles.js";

const router = Router();
const SALT_ROUNDS = 10;
const INVITE_DAYS = 14;

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

/**
 * Kutse loomine (RULE R1: rolli kontroll on siin, mitte peidetud nupus).
 * Vanema/õpilase konto saab tekkida AINULT sellest teest.
 */
router.post("/", requireAuth, requireRole(CAN_INVITE_ROLES), (req, res) => {
  const role = String(req.body?.role || "");
  const studentId = Number(req.body?.studentId);
  const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;

  if (!INVITE_ONLY_ROLES.includes(role)) {
    return res.status(400).json({ error: "Kutsuda saab ainult lapsevanemat või õpilast." });
  }
  if (!Number.isInteger(studentId)) {
    return res.status(400).json({ error: "Vali õpilane." });
  }
  if (email && !isValidEmail(email)) {
    return res.status(400).json({ error: "Kehtetu e-posti aadress." });
  }
  /** Kutsuda saab ainult lapse juurde, keda kutsuja ise näeb. */
  if (!canAccessStudent(req.user, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }
  if (req.user.schoolId == null) {
    return res.status(400).json({ error: "Sinu konto pole kooliga seotud." });
  }

  if (role === ROLES.STUDENT) {
    const already = db
      .prepare(`SELECT id FROM teachers WHERE linked_student_id = ?`)
      .get(studentId);
    if (already) {
      return res
        .status(409)
        .json({ error: "Sellel õpilasel on juba oma konto olemas." });
    }
  }
  if (role === ROLES.PARENT && email) {
    const existingParent = db
      .prepare(
        `SELECT t.id FROM teachers t
         JOIN parent_student_links l ON l.parent_id = t.id
         WHERE t.email = ? COLLATE NOCASE AND l.student_id = ?`
      )
      .get(email, studentId);
    if (existingParent) {
      return res
        .status(409)
        .json({ error: "See lapsevanem on juba selle lapsega seotud." });
    }
  }

  const token = newInviteToken();
  const info = db
    .prepare(
      `INSERT INTO invitations (token_hash, role, email, student_id, school_id, created_by, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))`
    )
    .run(
      hashToken(token),
      role,
      email,
      studentId,
      req.user.schoolId,
      req.user.id,
      `+${INVITE_DAYS} days`
    );

  audit(req, {
    action: "invitation.create",
    entityType: "invitation",
    entityId: info.lastInsertRowid,
    studentId,
  });

  /**
   * Token näidatakse siin ainult üks kord — andmebaasis on ainult räsi. Kui link kaob,
   * tuleb kutse tühistada ja uus luua. Absoluutse URL-i paneb kokku frontend.
   */
  res.status(201).json({
    invitation: { id: info.lastInsertRowid, role, email, studentId, expiresInDays: INVITE_DAYS },
    token,
    path: `/kutse/${token}`,
  });
});

/** Kooli kutsete nimekiri (ilma tokeniteta). */
router.get("/", requireAuth, requireStaff, (req, res) => {
  if (req.user.schoolId == null) return res.json({ invitations: [] });

  const studentIdParam = req.query.studentId;
  const filters = [`i.school_id = ?`];
  const params = [req.user.schoolId];

  if (studentIdParam !== undefined && studentIdParam !== "") {
    const id = Number(studentIdParam);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Kehtetu õpilase ID." });
    }
    filters.push(`i.student_id = ?`);
    params.push(id);
  }

  const rows = db
    .prepare(
      `SELECT i.id, i.role, i.email, i.student_id, i.created_at, i.expires_at,
              i.accepted_at, i.revoked_at,
              (i.expires_at <= datetime('now')) AS is_expired,
              s.name AS student_name, c.name AS class_name,
              creator.name AS created_by_name
       FROM invitations i
       LEFT JOIN students s ON s.id = i.student_id
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN teachers creator ON creator.id = i.created_by
       WHERE ${filters.join(" AND ")}
       ORDER BY i.id DESC
       LIMIT 200`
    )
    .all(...params);

  res.json({
    invitations: rows.map((r) => ({
      id: r.id,
      role: r.role,
      email: r.email,
      studentId: r.student_id,
      studentName: r.student_name,
      className: r.class_name,
      createdByName: r.created_by_name,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      status: r.revoked_at
        ? "revoked"
        : r.accepted_at
          ? "accepted"
          : r.is_expired
            ? "expired"
            : "pending",
    })),
  });
});

/** Tühistamine — kasutamata kutse muutub kohe kehtetuks. */
router.delete("/:id", requireAuth, requireRole(CAN_INVITE_ROLES), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Kehtetu ID." });
  }
  const row = db
    .prepare(`SELECT id, school_id, student_id, accepted_at FROM invitations WHERE id = ?`)
    .get(id);

  if (!row || Number(row.school_id) !== Number(req.user.schoolId)) {
    return res.status(404).json({ error: "Kutset ei leitud." });
  }
  if (row.accepted_at) {
    return res
      .status(409)
      .json({ error: "Kutse on juba kasutatud — konto tuleb eraldi eemaldada." });
  }

  db.prepare(
    `UPDATE invitations SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL`
  ).run(id);

  audit(req, {
    action: "invitation.revoke",
    entityType: "invitation",
    entityId: id,
    studentId: row.student_id,
  });

  res.json({ ok: true });
});

/** Aegumist võrreldakse SQL-is — SQLite datetime-string ja Date.parse ei ole usaldusväärne paar. */
const selectByToken = db.prepare(
  `SELECT i.*, (i.expires_at <= datetime('now')) AS is_expired,
          s.name AS student_name, c.name AS class_name, sc.name AS school_name
   FROM invitations i
   LEFT JOIN students s ON s.id = i.student_id
   LEFT JOIN classes c ON c.id = s.class_id
   LEFT JOIN schools sc ON sc.id = i.school_id
   WHERE i.token_hash = ?`
);

function loadUsableInvite(token) {
  const row = selectByToken.get(hashToken(token));
  if (!row) return { error: "Kutset ei leitud või link on vale." };
  if (row.revoked_at) return { error: "See kutse on tühistatud." };
  if (row.accepted_at) return { error: "See kutse on juba kasutatud." };
  if (row.is_expired) {
    return { error: "See kutse on aegunud. Palu koolist uus link." };
  }
  return { invite: row };
}

/** Avalik: kutse eelvaade enne konto loomist. */
router.get("/token/:token", (req, res) => {
  const { invite, error } = loadUsableInvite(req.params.token);
  if (error) return res.status(404).json({ error });

  res.json({
    invitation: {
      role: invite.role,
      email: invite.email,
      studentName: invite.student_name,
      className: invite.class_name,
      schoolName: invite.school_name,
      expiresAt: invite.expires_at,
    },
  });
});

/** Avalik: kutse vastuvõtmine — loob konto ja logib sisse. */
router.post("/token/:token/accept", (req, res) => {
  const { invite, error } = loadUsableInvite(req.params.token);
  if (error) return res.status(404).json({ error });

  const name = String(req.body?.name || "").trim();
  const password = req.body?.password;
  /** Kui kool määras e-posti, siis see kehtib — kutsutu ei saa seda üle kirjutada. */
  const email = invite.email
    ? String(invite.email).trim().toLowerCase()
    : String(req.body?.email || "").trim().toLowerCase();

  if (!name) return res.status(400).json({ error: "Nimi on kohustuslik." });
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "Kehtiv e-posti aadress on kohustuslik." });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "Parool peab olema vähemalt 8 tähemärki." });
  }

  const taken = db
    .prepare(`SELECT id FROM teachers WHERE email = ? COLLATE NOCASE`)
    .get(email);
  if (taken) {
    return res.status(409).json({
      error: "See e-posti aadress on juba kasutusel. Logi sisse olemasoleva kontoga.",
    });
  }

  const password_hash = bcrypt.hashSync(password, SALT_ROUNDS);

  let accountId;
  try {
    accountId = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO teachers (email, password_hash, name, role, school_id, linked_student_id)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          email,
          password_hash,
          name.slice(0, 120),
          invite.role,
          invite.school_id,
          invite.role === ROLES.STUDENT ? invite.student_id : null
        );

      if (invite.role === ROLES.PARENT) {
        db.prepare(
          `INSERT OR IGNORE INTO parent_student_links (parent_id, student_id) VALUES (?, ?)`
        ).run(info.lastInsertRowid, invite.student_id);
      }

      /** Tingimus revoked/accepted vastu hoiab ära kahe samaaegse lunastuse. */
      const claimed = db
        .prepare(
          `UPDATE invitations SET accepted_by = ?, accepted_at = datetime('now')
           WHERE id = ? AND accepted_at IS NULL AND revoked_at IS NULL`
        )
        .run(info.lastInsertRowid, invite.id);

      if (claimed.changes !== 1) {
        throw new Error("INVITE_ALREADY_USED");
      }
      return info.lastInsertRowid;
    })();
  } catch (e) {
    if (e?.message === "INVITE_ALREADY_USED") {
      return res.status(409).json({ error: "See kutse on juba kasutatud." });
    }
    throw e;
  }

  const teacher = accountPayload(accountId);
  audit(
    { user: { id: accountId, role: invite.role } },
    {
      action: "invitation.accept",
      entityType: "invitation",
      entityId: invite.id,
      studentId: invite.student_id,
    }
  );

  res.status(201).json({ teacher, token: signToken(accountId) });
});

export default router;
