import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

export default db;
