import jwt from "jsonwebtoken";
import db from "../db.js";
import { STAFF_ROLES, LEADERSHIP_ROLES } from "../constants/roles.js";
import { jwtSecret } from "../utils/jwt.js";

if (!process.env.JWT_SECRET && process.env.NODE_ENV !== "production") {
  console.warn(
    "HOIATUS: JWT_SECRET puudub. Kohalikult kasutatakse arenduse varuvõtit. " +
      "Lisa server/.env faili muutuja JWT_SECRET."
  );
}

const selectUser = db.prepare(
  `SELECT id, email, name, role, school_id, linked_student_id
   FROM teachers WHERE id = ?`
);

/**
 * Roll loetakse igal päringul andmebaasist, mitte tokenist: rolli äravõtmine
 * peab kehtima kohe, mitte alles siis, kui 7-päevane token aegub.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Autentimine on vajalik." });
  }

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret());
  } catch {
    return res.status(401).json({ error: "Kehtetu või aegunud seanss." });
  }

  const row = selectUser.get(payload.sub);
  if (!row) {
    return res.status(401).json({ error: "Kehtetu või aegunud seanss." });
  }

  req.user = {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role || "teacher",
    schoolId: row.school_id ?? null,
    linkedStudentId: row.linked_student_id ?? null,
  };
  /** Tagasiühilduvus: olemasolevad marsruudid kasutavad req.teacherId. */
  req.teacherId = row.id;
  next();
}

/**
 * RULE R1 — rollikontroll käib ALATI siit läbi, mitte ainult peidetud UI-nuppudest.
 * Kasutus: `router.post("/x", requireAuth, requireRole("headteacher", "principal"), handler)`
 */
export function requireRole(...roles) {
  const allowed = new Set(roles.flat());
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Autentimine on vajalik." });
    }
    if (!allowed.has(req.user.role)) {
      return res.status(403).json({ error: "Sul pole selleks õigust." });
    }
    next();
  };
}

export const requireStaff = requireRole(STAFF_ROLES);
export const requireLeadership = requireRole(LEADERSHIP_ROLES);
