import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { canAccessStudent } from "../services/access.js";

const router = Router();

/**
 * Pädevused = korduvad, ainetevahelised oskused, mille külge hinne kinnitatakse.
 * Nii on areng nähtav ka üle ainete ja õppeaastate, mitte ainult teema kaupa.
 * Vt roadmap 3.1 ja ARHITEKTUUR_JA_PLAAN Faas 1a.
 */

/** Üldpädevused (school_id NULL) + selle kooli enda omad. */
router.get("/", requireAuth, requireStaff, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, name, subject_area, is_core, school_id
       FROM competencies
       WHERE school_id IS NULL OR school_id = ?
       ORDER BY is_core DESC, name COLLATE NOCASE`
    )
    .all(req.user.schoolId ?? -1);

  res.json({
    competencies: rows.map((r) => ({
      id: r.id,
      name: r.name,
      subjectArea: r.subject_area,
      isCore: Boolean(r.is_core),
      isSchoolOwn: r.school_id != null,
    })),
  });
});

/** Kooli enda oskuse lisamine (nt "murdude tehted"). */
router.post("/", requireAuth, requireStaff, (req, res) => {
  const name = String(req.body?.name || "").trim();
  const subjectArea = req.body?.subjectArea
    ? String(req.body.subjectArea).trim().slice(0, 80)
    : null;

  if (name.length < 2) {
    return res.status(400).json({ error: "Pädevuse nimi on liiga lühike." });
  }
  if (req.user.schoolId == null) {
    return res.status(400).json({ error: "Sinu konto pole kooliga seotud." });
  }

  const existing = db
    .prepare(
      `SELECT id FROM competencies
       WHERE name = ? COLLATE NOCASE AND (school_id IS NULL OR school_id = ?)`
    )
    .get(name, req.user.schoolId);
  if (existing) {
    return res.status(409).json({ error: "Selline pädevus on juba olemas." });
  }

  const info = db
    .prepare(
      `INSERT INTO competencies (name, subject_area, is_core, school_id)
       VALUES (?, ?, 0, ?)`
    )
    .run(name.slice(0, 120), subjectArea, req.user.schoolId);

  audit(req, {
    action: "competency.create",
    entityType: "competency",
    entityId: info.lastInsertRowid,
  });

  res.status(201).json({ id: info.lastInsertRowid, name, subjectArea });
});

/**
 * Õpilase pädevuste kaart — hinded koondatud pädevuste kaupa.
 * Keskmine on kaalumata: iga hinne loeb ühe korra, ka kui ta on mitme pädevuse küljes.
 */
router.get("/student/:studentId", requireAuth, (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!Number.isInteger(studentId)) {
    return res.status(400).json({ error: "Kehtetu ID." });
  }
  if (!canAccessStudent(req.user, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }

  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.subject_area, c.is_core,
              COUNT(g.id) AS grade_count,
              AVG(g.score) AS avg_score,
              MAX(g.date) AS last_date
       FROM competencies c
       JOIN grade_competencies gc ON gc.competency_id = c.id
       JOIN grades g ON g.id = gc.grade_id
       WHERE g.student_id = ?
       GROUP BY c.id
       ORDER BY avg_score ASC`
    )
    .all(studentId);

  audit(req, {
    action: "competency.view_student_map",
    entityType: "student",
    entityId: studentId,
    studentId,
  });

  res.json({
    competencies: rows.map((r) => ({
      id: r.id,
      name: r.name,
      subjectArea: r.subject_area,
      isCore: Boolean(r.is_core),
      gradeCount: r.grade_count,
      averagePercent:
        r.avg_score != null ? Math.round(Number(r.avg_score) * 10) / 10 : null,
      lastDate: r.last_date,
    })),
  });
});

/** Hinde sidumine pädevustega — asendab senise valiku tervikuna. */
router.put("/grade/:gradeId", requireAuth, requireStaff, (req, res) => {
  const gradeId = Number(req.params.gradeId);
  const ids = Array.isArray(req.body?.competencyIds) ? req.body.competencyIds : [];
  if (!Number.isInteger(gradeId)) {
    return res.status(400).json({ error: "Kehtetu ID." });
  }

  const grade = db
    .prepare(`SELECT id, student_id FROM grades WHERE id = ?`)
    .get(gradeId);
  if (!grade || !canAccessStudent(req.user, grade.student_id)) {
    return res.status(404).json({ error: "Hinnet ei leitud." });
  }

  /** Ainult pädevused, mis on sellele koolile nähtavad. */
  const allowed = new Set(
    db
      .prepare(
        `SELECT id FROM competencies WHERE school_id IS NULL OR school_id = ?`
      )
      .all(req.user.schoolId ?? -1)
      .map((r) => Number(r.id))
  );

  const clean = [...new Set(ids.map(Number))].filter(
    (id) => Number.isInteger(id) && allowed.has(id)
  );

  const link = db.prepare(
    `INSERT OR IGNORE INTO grade_competencies (grade_id, competency_id) VALUES (?, ?)`
  );
  db.transaction(() => {
    db.prepare(`DELETE FROM grade_competencies WHERE grade_id = ?`).run(gradeId);
    for (const id of clean) link.run(gradeId, id);
  })();

  audit(req, {
    action: "competency.link_grade",
    entityType: "grade",
    entityId: gradeId,
    studentId: grade.student_id,
  });

  res.json({ gradeId, competencyIds: clean });
});

export default router;
