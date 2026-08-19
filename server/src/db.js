import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { newJoinCode } from "./utils/codes.js";
import { runFaas1bMigration } from "./migrations/faas1b.js";
import { runFaas2Migration } from "./migrations/faas2.js";
import { runFaas4Migration } from "./migrations/faas4.js";
import { runFaas5Migration } from "./migrations/faas5.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath =
  process.env.DATABASE_PATH || path.join(__dirname, "..", "data", "eduai.db");

const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 110),
    date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS learning_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    plan_text TEXT NOT NULL,
    weeks INTEGER NOT NULL CHECK (weeks >= 1 AND weeks <= 4),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('worksheet', 'test', 'lesson_plan')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
  CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
  CREATE INDEX IF NOT EXISTS idx_topics_class ON topics(class_id);
  CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
  CREATE INDEX IF NOT EXISTS idx_grades_topic ON grades(topic_id);
  CREATE INDEX IF NOT EXISTS idx_grades_date ON grades(date);

  CREATE TABLE IF NOT EXISTS weekly_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    week_start TEXT NOT NULL,
    title TEXT NOT NULL,
    plan_text TEXT NOT NULL,
    reminders_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_weekly_plans_class ON weekly_plans(class_id);
  CREATE INDEX IF NOT EXISTS idx_weekly_plans_week ON weekly_plans(week_start);

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'late', 'absent')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(student_id, date)
  );

  CREATE TABLE IF NOT EXISTS behavior_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('positive', 'concern', 'incident')),
    note TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS wellbeing_checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    mood TEXT NOT NULL CHECK (mood IN ('good', 'ok', 'hard')),
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS student_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('academic', 'personal')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS mentor_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
  CREATE INDEX IF NOT EXISTS idx_behavior_student ON behavior_notes(student_id);
  CREATE INDEX IF NOT EXISTS idx_wellbeing_student ON wellbeing_checkins(student_id);
  CREATE INDEX IF NOT EXISTS idx_goals_student ON student_goals(student_id);
  CREATE INDEX IF NOT EXISTS idx_mentor_notes_student ON mentor_notes(student_id);
`);

const lpCols = db.prepare(`PRAGMA table_info(learning_plans)`).all();
if (!lpCols.some((c) => c.name === "analysis_json")) {
  db.exec(`ALTER TABLE learning_plans ADD COLUMN analysis_json TEXT`);
}

const gradeCols = db.prepare(`PRAGMA table_info(grades)`).all();
if (!gradeCols.some((c) => c.name === "ai_feedback")) {
  db.exec(`ALTER TABLE grades ADD COLUMN ai_feedback TEXT`);
}

/** Vanemad andmebaasid: score CHECK võib olla <= 100 või <= 200; limiit on 110 (lisaülesanded). */
const gradesSql = db
  .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'grades'`)
  .get()?.sql;
if (
  gradesSql &&
  (gradesSql.includes("score <= 100") || gradesSql.includes("score <= 200")) &&
  !gradesSql.includes("score <= 110")
) {
  db.exec(`
    BEGIN;
    CREATE TABLE grades__migrated (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      score INTEGER NOT NULL CHECK (score >= 0 AND score <= 110),
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      ai_feedback TEXT
    );
    INSERT INTO grades__migrated (id, student_id, topic_id, score, date, notes, created_at, ai_feedback)
    SELECT id, student_id, topic_id, score, date, notes, created_at, ai_feedback FROM grades;
    DROP TABLE grades;
    ALTER TABLE grades__migrated RENAME TO grades;
    CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
    CREATE INDEX IF NOT EXISTS idx_grades_topic ON grades(topic_id);
    CREATE INDEX IF NOT EXISTS idx_grades_date ON grades(date);
    COMMIT;
  `);
}

/* ------------------------------------------------------------------ *
 * FAAS 0 — koolid, rollid, kutsed, audit log
 *
 * Kõik siin on lisav: olemasolevaid tabeleid ega veerge ei muudeta ega
 * kustutata, nii et vanad kontod ja andmed jäävad tööle.
 * Vt docs/ARHITEKTUUR_JA_PLAAN.md punktid K1 ja K5.
 * ------------------------------------------------------------------ */

db.exec(`
  CREATE TABLE IF NOT EXISTS schools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    join_code TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS parent_student_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(parent_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER,
    actor_role TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    student_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    email TEXT,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    accepted_by INTEGER REFERENCES teachers(id),
    accepted_at TEXT,
    revoked_at TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON parent_student_links(parent_id);
  CREATE INDEX IF NOT EXISTS idx_parent_links_student ON parent_student_links(student_id);
  CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
  CREATE INDEX IF NOT EXISTS idx_audit_student ON audit_log(student_id);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_invitations_school ON invitations(school_id);
  CREATE INDEX IF NOT EXISTS idx_invitations_student ON invitations(student_id);
`);

const teacherCols = db.prepare(`PRAGMA table_info(teachers)`).all();
const hasTeacherCol = (name) => teacherCols.some((c) => c.name === name);

/**
 * Rolli CHECK-piirangut ei lisata: SQLite ADD COLUMN piirangud teevad selle ebausaldusväärseks
 * ja kogu tabeli ümberehitamine ainult selle nimel oleks suurem risk kui kasu. Kehtivust
 * valvab server/src/constants/roles.js (isValidRole) igal kirjutamisteel.
 */
if (!hasTeacherCol("role")) {
  db.exec(`ALTER TABLE teachers ADD COLUMN role TEXT NOT NULL DEFAULT 'teacher'`);
}
if (!hasTeacherCol("school_id")) {
  db.exec(`ALTER TABLE teachers ADD COLUMN school_id INTEGER REFERENCES schools(id)`);
}
/** Õpilase rolliga konto seos oma `students` kirjega. */
if (!hasTeacherCol("linked_student_id")) {
  db.exec(
    `ALTER TABLE teachers ADD COLUMN linked_student_id INTEGER REFERENCES students(id)`
  );
}

/**
 * Olemasolevad kontod said kooli enne, kui koolid olemas olid. Igaüks saab OMA kooli —
 * kõigi kokku panemine ühte kooli avaks nende andmed üksteisele.
 */
const teachersWithoutSchool = db
  .prepare(`SELECT id, name FROM teachers WHERE school_id IS NULL`)
  .all();

if (teachersWithoutSchool.length) {
  const insertSchool = db.prepare(
    `INSERT INTO schools (name, join_code) VALUES (?, ?)`
  );
  const setSchool = db.prepare(`UPDATE teachers SET school_id = ? WHERE id = ?`);
  db.transaction(() => {
    for (const t of teachersWithoutSchool) {
      const info = insertSchool.run(`${t.name} kool`, newJoinCode());
      setSchool.run(info.lastInsertRowid, t.id);
    }
  })();
  console.log(
    `[EduAI migratsioon] ${teachersWithoutSchool.length} kontole loodi oma kool.`
  );
}

/* ------------------------------------------------------------------ *
 * FAAS 1a — pädevused
 *
 * Ainult lisav. Olemasolevaid tabeleid ei puudutata: `attendance`,
 * `behavior_notes` ja `wellbeing_checkins` migratsioon on eraldi samm (Faas 1b),
 * sest see nõuab tabeli ümberehitamist päris andmetega.
 * ------------------------------------------------------------------ */

db.exec(`
  CREATE TABLE IF NOT EXISTS competencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject_area TEXT,
    is_core INTEGER NOT NULL DEFAULT 0,
    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(name, school_id)
  );

  CREATE TABLE IF NOT EXISTS grade_competencies (
    grade_id INTEGER NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
    competency_id INTEGER NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
    PRIMARY KEY (grade_id, competency_id)
  );

  CREATE INDEX IF NOT EXISTS idx_competencies_school ON competencies(school_id);
  CREATE INDEX IF NOT EXISTS idx_grade_comp_competency ON grade_competencies(competency_id);
`);

/**
 * UNIQUE(name, school_id) EI kata üldpädevusi: SQLite loeb NULL-id UNIQUE-piirangus
 * erinevaks, seega school_id IS NULL ridu saaks lisada lõpmatuseni. Seda juhtuski —
 * iga serveri taaskäivitus lisas 8 rida juurde. Osaline unikaalindeks parandab selle,
 * aga indeksit ei saa luua, kui duplikaadid on juba sees, seega puhastus käib enne.
 */
const coreDuplicates = db
  .prepare(
    `SELECT name, COUNT(*) AS n FROM competencies
     WHERE school_id IS NULL GROUP BY name HAVING n > 1`
  )
  .all();

if (coreDuplicates.length) {
  db.transaction(() => {
    /** Olemasolevad seosed suunatakse alles jäävale kirjele (OR IGNORE: seos võib juba olla). */
    db.exec(`
      UPDATE OR IGNORE grade_competencies
      SET competency_id = (
        SELECT MIN(keep.id) FROM competencies keep
        WHERE keep.school_id IS NULL
          AND keep.name = (
            SELECT dup.name FROM competencies dup WHERE dup.id = grade_competencies.competency_id
          )
      )
      WHERE competency_id IN (SELECT id FROM competencies WHERE school_id IS NULL);
    `);
    db.exec(`
      DELETE FROM competencies
      WHERE school_id IS NULL
        AND id NOT IN (
          SELECT MIN(id) FROM competencies WHERE school_id IS NULL GROUP BY name
        );
    `);
  })();
  console.log(
    `[EduAI migratsioon] Eemaldati üldpädevuste duplikaadid (${coreDuplicates.length} nime).`
  );
}

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_competencies_core_name
    ON competencies(name) WHERE school_id IS NULL;
`);

/**
 * Põhikooli riikliku õppekava üldpädevused. `school_id IS NULL` tähendab, et need on
 * kõigile koolidele ühised ja neid ei kustutata koos kooliga; kool lisab juurde oma
 * ainepõhised oskused (nt "murdude tehted", "argumenteeriv kirjutamine").
 *
 * ⚠️ See nimekiri tuleb kehtiva õppekava vastu üle kontrollida enne pilooti —
 * seda ei tohi jätta mälu järgi kirjutatuks.
 */
const CORE_COMPETENCIES = [
  "Kultuuri- ja väärtuspädevus",
  "Sotsiaalne ja kodanikupädevus",
  "Enesemääratluspädevus",
  "Õpipädevus",
  "Suhtluspädevus",
  "Matemaatika-, loodusteaduste ja tehnoloogiaalane pädevus",
  "Ettevõtlikkuspädevus",
  "Digipädevus",
];

const insertCore = db.prepare(
  `INSERT OR IGNORE INTO competencies (name, subject_area, is_core, school_id)
   VALUES (?, 'üldpädevus', 1, NULL)`
);
db.transaction(() => {
  for (const name of CORE_COMPETENCIES) insertCore.run(name);
})();

/* ------------------------------------------------------------------ *
 * FAAS 1b — kohalolek, käitumine, heaolu
 *
 * Eraldi moodulis, sest see on ainus migratsioon, mis ehitab ümber tabeli,
 * kus on päris andmeid. Ridade arvu kontroll on migratsiooni sees: kui
 * kopeeritud ridu on vähem kui algseid, katkeb transaktsioon ja vana tabel
 * jääb puutumata.
 * ------------------------------------------------------------------ */
const faas1b = runFaas1bMigration(db);
if (faas1b.changed) {
  for (const note of faas1b.notes) {
    console.log(`[EduAI migratsioon 1b] ${note}`);
  }
}

/* FAAS 2 — tunniplaan, asendused, eksamid, lapsevanema päev (ainult uued tabelid). */
runFaas2Migration(db);

/* FAAS 4 — vestlused ja sõnumid (ainult uued tabelid). */
runFaas4Migration(db);

/* FAAS 5 — mentorlus: olemasolevate tabelite laiendus, mitte uued tabelid (K2). */
const faas5 = runFaas5Migration(db);
if (faas5.changed) {
  for (const note of faas5.notes) console.log(`[EduAI migratsioon 5] ${note}`);
}

export default db;
