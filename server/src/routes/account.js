import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { accountPayload } from "./auth.js";
import {
  STAFF_ROLES,
  LEADERSHIP_ROLES,
  isLeadership,
  roleLabel,
} from "../constants/roles.js";

const router = Router();

const countMembers = db.prepare(
  `SELECT COUNT(*) AS n FROM teachers WHERE school_id = ?`
);
const countLeadership = db.prepare(
  `SELECT COUNT(*) AS n FROM teachers
   WHERE school_id = ? AND role IN (${LEADERSHIP_ROLES.map(() => "?").join(", ")})`
);

/**
 * Kes tohib kooli seadeid ja rolle muuta.
 *
 * Päris koolis teeb seda juhtkond. Aga kuskilt peab alustama: kui koolis pole veel
 * ühtegi juhtkonna liiget (või on ainult üks konto — nt vanad kontod, mis said kooli
 * migratsiooniga), peab esimene inimene saama end ise paika panna. Muidu jääks kool
 * igaveseks lukku. Iga muudatus läheb audit_log-i.
 */
function schoolAdminRights(user) {
  if (user.schoolId == null) {
    return { allowed: false, reason: "Sinu konto pole kooliga seotud." };
  }
  if (isLeadership(user.role)) return { allowed: true, basis: "leadership" };

  const members = countMembers.get(user.schoolId)?.n ?? 0;
  if (members <= 1) return { allowed: true, basis: "sole_member" };

  const leaders = countLeadership.get(user.schoolId, ...LEADERSHIP_ROLES)?.n ?? 0;
  if (leaders === 0) return { allowed: true, basis: "no_leadership_yet" };

  return {
    allowed: false,
    reason: "Rolle ja kooli nime muudab õppealajuhataja või direktor.",
  };
}

/** Mida see kasutaja seadetes teha tohib — frontend kasutab seda UI peitmiseks. */
router.get("/permissions", requireAuth, requireStaff, (req, res) => {
  const rights = schoolAdminRights(req.user);
  res.json({
    canManageSchool: rights.allowed,
    basis: rights.basis || null,
    reason: rights.reason || null,
    availableRoles: STAFF_ROLES.map((r) => ({ value: r, label: roleLabel(r) })),
  });
});

/** Kooli liikmed — kes veel sama liitumiskoodiga liitunud on. */
router.get("/school/members", requireAuth, requireStaff, (req, res) => {
  if (req.user.schoolId == null) return res.json({ members: [] });

  const members = db
    .prepare(
      `SELECT id, name, email, role FROM teachers
       WHERE school_id = ? AND role IN (${STAFF_ROLES.map(() => "?").join(", ")})
       ORDER BY name COLLATE NOCASE`
    )
    .all(req.user.schoolId, ...STAFF_ROLES);

  res.json({
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      roleLabel: roleLabel(m.role),
      isMe: Number(m.id) === Number(req.user.id),
    })),
  });
});

/** Kooli ümbernimetamine. */
router.patch("/school", requireAuth, requireStaff, (req, res) => {
  const rights = schoolAdminRights(req.user);
  if (!rights.allowed) {
    return res.status(403).json({ error: rights.reason });
  }

  const name = String(req.body?.name || "").trim();
  if (name.length < 2) {
    return res.status(400).json({ error: "Kooli nimi on liiga lühike." });
  }

  db.prepare(`UPDATE schools SET name = ? WHERE id = ?`).run(
    name.slice(0, 120),
    req.user.schoolId
  );

  audit(req, {
    action: "school.rename",
    entityType: "school",
    entityId: req.user.schoolId,
  });

  res.json({ teacher: accountPayload(req.user.id) });
});

/** Oma rolli muutmine. Vanem ja õpilane siia ei pääse (requireStaff). */
router.patch("/role", requireAuth, requireStaff, (req, res) => {
  const rights = schoolAdminRights(req.user);
  if (!rights.allowed) {
    return res.status(403).json({ error: rights.reason });
  }

  const role = String(req.body?.role || "");
  if (!STAFF_ROLES.includes(role)) {
    return res.status(400).json({ error: "Vali kehtiv koolitöötaja roll." });
  }

  const previous = req.user.role;
  db.prepare(`UPDATE teachers SET role = ? WHERE id = ?`).run(role, req.user.id);

  audit(req, {
    action: `account.role_change:${previous}->${role}`,
    entityType: "teacher",
    entityId: req.user.id,
  });

  res.json({ teacher: accountPayload(req.user.id) });
});

export default router;
