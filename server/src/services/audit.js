import db from "../db.js";

const insert = db.prepare(
  `INSERT INTO audit_log (actor_id, actor_role, action, entity_type, entity_id, student_id)
   VALUES (?, ?, ?, ?, ?, ?)`
);

/**
 * RULE R3 / RULE A4 — iga tundlik lugemine ja kirjutamine logitakse: kes, mis tegevus,
 * mis kirje, millise lapse kohta.
 *
 * Logimine ei tohi kunagi päringut katki teha — kui audit kirjutamine ebaõnnestub,
 * läheb see konsooli ja päring jätkub.
 *
 * @param {object} req Express päring (kasutab req.user)
 * @param {{ action: string, entityType?: string|null, entityId?: number|null, studentId?: number|null }} entry
 */
export function audit(req, { action, entityType = null, entityId = null, studentId = null }) {
  try {
    insert.run(
      req?.user?.id ?? null,
      req?.user?.role ?? null,
      String(action),
      entityType,
      entityId != null ? Number(entityId) : null,
      studentId != null ? Number(studentId) : null
    );
  } catch (e) {
    console.error("[EduAI audit] kirjutamine ebaõnnestus:", e?.message || e);
  }
}

/** Ühe õpilase auditijälg — kes on tema andmeid vaadanud või muutnud. */
export function auditTrailForStudent(studentId, limit = 100) {
  return db
    .prepare(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.created_at,
              a.actor_role, t.name AS actor_name
       FROM audit_log a
       LEFT JOIN teachers t ON t.id = a.actor_id
       WHERE a.student_id = ?
       ORDER BY a.id DESC
       LIMIT ?`
    )
    .all(Number(studentId), Number(limit));
}
