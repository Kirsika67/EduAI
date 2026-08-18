import db from "../db.js";
import { ROLES, seesWholeSchool } from "../constants/roles.js";

/**
 * Kes millist last näeb (RULE R2). Kool on piir, mille sees koolitöötaja üldse midagi näeb —
 * ilma selleta tähendaks "kooli ülevaade" kõiki andmebaasi õpilasi (vt ARHITEKTUUR_JA_PLAAN K5).
 *
 * Ulatus rolli järgi:
 *   teacher, homeroom_teacher   → ainult enda klasside õpilased
 *   support_specialist          → kogu kool
 *   headteacher, principal      → kogu kool
 *   parent                      → ainult parent_student_links kaudu seotud lapsed
 *   student                     → ainult enda kirje
 *
 * Klassijuhataja on teadlikult kitsas seni, kuni klassijuhatamine on andmemudelis
 * olemas (Faas 2) — andmete minimeerimine on vaikimisi valik.
 */
const studentScopeRow = db.prepare(
  `SELECT s.id AS student_id, c.id AS class_id, c.teacher_id, t.school_id
   FROM students s
   JOIN classes c ON c.id = s.class_id
   JOIN teachers t ON t.id = c.teacher_id
   WHERE s.id = ?`
);

const parentLinkRow = db.prepare(
  `SELECT 1 FROM parent_student_links WHERE parent_id = ? AND student_id = ?`
);

export function canAccessStudent(user, studentId) {
  const id = Number(studentId);
  if (!user || !Number.isInteger(id)) return false;

  if (user.role === ROLES.STUDENT) {
    return Number(user.linkedStudentId) === id;
  }
  if (user.role === ROLES.PARENT) {
    return Boolean(parentLinkRow.get(user.id, id));
  }

  const row = studentScopeRow.get(id);
  if (!row) return false;

  if (seesWholeSchool(user.role)) {
    return user.schoolId != null && Number(row.school_id) === Number(user.schoolId);
  }
  return Number(row.teacher_id) === Number(user.id);
}

/** Klassid, mida kasutaja tohib näha. */
export function visibleClassIds(user) {
  if (!user) return [];

  if (user.role === ROLES.STUDENT) {
    if (!user.linkedStudentId) return [];
    return db
      .prepare(`SELECT class_id AS id FROM students WHERE id = ?`)
      .all(user.linkedStudentId)
      .map((r) => Number(r.id));
  }

  if (user.role === ROLES.PARENT) {
    return db
      .prepare(
        `SELECT DISTINCT s.class_id AS id
         FROM parent_student_links l
         JOIN students s ON s.id = l.student_id
         WHERE l.parent_id = ?`
      )
      .all(user.id)
      .map((r) => Number(r.id));
  }

  if (seesWholeSchool(user.role)) {
    if (user.schoolId == null) return [];
    return db
      .prepare(
        `SELECT c.id FROM classes c
         JOIN teachers t ON t.id = c.teacher_id
         WHERE t.school_id = ?`
      )
      .all(user.schoolId)
      .map((r) => Number(r.id));
  }

  return db
    .prepare(`SELECT id FROM classes WHERE teacher_id = ?`)
    .all(user.id)
    .map((r) => Number(r.id));
}

/** Vanema lapsed. */
export function linkedStudentsForParent(parentId) {
  return db
    .prepare(
      `SELECT s.id, s.name, s.class_id, c.name AS class_name, c.subject
       FROM parent_student_links l
       JOIN students s ON s.id = l.student_id
       JOIN classes c ON c.id = s.class_id
       WHERE l.parent_id = ?
       ORDER BY s.name COLLATE NOCASE`
    )
    .all(parentId);
}

/** Millisesse kooli õpilane kuulub (klassi omaniku kaudu). */
export function schoolIdForStudent(studentId) {
  const row = studentScopeRow.get(Number(studentId));
  return row ? Number(row.school_id) : null;
}
