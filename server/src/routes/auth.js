import { Router } from "express";
import bcrypt from "bcrypt";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { linkedStudentsForParent } from "../services/access.js";
import { newJoinCode } from "../utils/codes.js";
import { signToken } from "../utils/jwt.js";
import {
  ROLES,
  STAFF_ROLES,
  INVITE_ONLY_ROLES,
  isStaff,
  roleLabel,
} from "../constants/roles.js";

const router = Router();
const SALT_ROUNDS = 10;

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

/**
 * Konto kuju, mida frontend ootab. Võti on ajaloolistel põhjustel `teacher`, ka
 * vanema ja õpilase puhul — nii ei murdu olemasolev AuthContext.
 */
export function accountPayload(id) {
  const row = db
    .prepare(
      `SELECT t.id, t.email, t.name, t.role, t.created_at,
              t.school_id, t.linked_student_id,
              s.name AS school_name, s.join_code
       FROM teachers t
       LEFT JOIN schools s ON s.id = t.school_id
       WHERE t.id = ?`
    )
    .get(id);

  if (!row) return null;

  const account = {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role || ROLES.TEACHER,
    roleLabel: roleLabel(row.role || ROLES.TEACHER),
    created_at: row.created_at,
    linkedStudentId: row.linked_student_id ?? null,
    school: row.school_id
      ? {
          id: row.school_id,
          name: row.school_name,
          /** Liitumiskood on kutse-taoline saladus — ainult koolitöötajale. */
          joinCode: isStaff(row.role) ? row.join_code : null,
        }
      : null,
  };

  if (account.role === ROLES.PARENT) {
    account.children = linkedStudentsForParent(row.id).map((s) => ({
      id: s.id,
      name: s.name,
      className: s.class_name,
    }));
  }

  if (account.role === ROLES.STUDENT && row.linked_student_id) {
    const own = db
      .prepare(
        `SELECT s.id, s.name, c.name AS class_name
         FROM students s JOIN classes c ON c.id = s.class_id
         WHERE s.id = ?`
      )
      .get(row.linked_student_id);
    account.children = own
      ? [{ id: own.id, name: own.name, className: own.class_name }]
      : [];
  }

  return account;
}

router.post("/register", (req, res) => {
  const { name, email, password, role, schoolName, schoolCode } = req.body || {};

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Nimi on kohustuslik." });
  }
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({
      error: "Kehtiv e-posti aadress on kohustuslik.",
    });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return res
      .status(400)
      .json({ error: "Parool peab olema vähemalt 8 tähemärki." });
  }

  const chosenRole = role ? String(role) : ROLES.TEACHER;
  if (INVITE_ONLY_ROLES.includes(chosenRole)) {
    return res.status(400).json({
      error:
        "Lapsevanema ja õpilase kontod luuakse ainult kooli kutse kaudu, mitte avalikust registreerimisest.",
    });
  }
  if (!STAFF_ROLES.includes(chosenRole)) {
    return res.status(400).json({ error: "Vali kehtiv roll." });
  }

  const existing = db
    .prepare("SELECT id FROM teachers WHERE email = ? COLLATE NOCASE")
    .get(email.trim().toLowerCase());

  if (existing) {
    return res.status(409).json({
      error: "See e-posti aadress on juba registreeritud.",
    });
  }

  /**
   * Kas liitub olemasoleva kooliga (kood) või loob uue.
   *
   * `joinCode` on alias, sest vastuses kannab sama väli nime `school.joinCode`.
   * Vale nimega kutse ei anna viga, vaid loob vaikselt eraldi kooli — seega
   * võtame mõlemat vastu, et see lõks ei jääks ootama.
   */
  let schoolId;
  const rawCode = schoolCode ?? req.body?.joinCode;
  const code = rawCode ? String(rawCode).trim().toUpperCase() : "";
  if (code) {
    const school = db
      .prepare(`SELECT id FROM schools WHERE join_code = ? COLLATE NOCASE`)
      .get(code);
    if (!school) {
      return res.status(404).json({
        error: "Sellist kooli liitumiskoodi ei leitud. Kontrolli koodi kooli haldajalt.",
      });
    }
    schoolId = school.id;
  } else {
    const cleanSchoolName =
      schoolName && String(schoolName).trim()
        ? String(schoolName).trim().slice(0, 120)
        : `${name.trim()} kool`;
    const info = db
      .prepare(`INSERT INTO schools (name, join_code) VALUES (?, ?)`)
      .run(cleanSchoolName, newJoinCode());
    schoolId = info.lastInsertRowid;
  }

  const password_hash = bcrypt.hashSync(password, SALT_ROUNDS);
  const info = db
    .prepare(
      `INSERT INTO teachers (email, password_hash, name, role, school_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      email.trim().toLowerCase(),
      password_hash,
      name.trim(),
      chosenRole,
      schoolId
    );

  const teacher = accountPayload(info.lastInsertRowid);
  audit(
    { user: { id: teacher.id, role: teacher.role } },
    { action: "account.register", entityType: "teacher", entityId: teacher.id }
  );

  const token = signToken(teacher.id);
  res.status(201).json({ teacher, token });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      error: "E-posti aadress ja parool on kohustuslikud.",
    });
  }

  const row = db
    .prepare(
      "SELECT id, password_hash FROM teachers WHERE email = ? COLLATE NOCASE"
    )
    .get(String(email).trim().toLowerCase());

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: "Vale e-post või parool." });
  }

  const teacher = accountPayload(row.id);
  audit(
    { user: { id: teacher.id, role: teacher.role } },
    { action: "account.login", entityType: "teacher", entityId: teacher.id }
  );

  const token = signToken(teacher.id);
  res.json({ teacher, token });
});

router.get("/me", requireAuth, (req, res) => {
  const teacher = accountPayload(req.user.id);
  if (!teacher) {
    return res.status(404).json({ error: "Kasutajat ei leitud." });
  }
  res.json({ teacher });
});

export default router;
