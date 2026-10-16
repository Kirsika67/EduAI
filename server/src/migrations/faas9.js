/**
 * FAAS 9 — ülesanded ja kodutööd.
 *
 * Puhtalt lisav: üks uus tabel. Ülesanne kuulub klassile; kes klassi näeb
 * (õpetaja, vanem, õpilane), näeb ka selle ülesandeid.
 */
export function runFaas9Migration(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      kind TEXT NOT NULL DEFAULT 'homework' CHECK (kind IN ('homework', 'task')),
      due_date TEXT NOT NULL,
      created_by INTEGER REFERENCES teachers(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_assignments_class_due ON assignments(class_id, due_date);

    CREATE TABLE IF NOT EXISTS teacher_absences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      date_from TEXT NOT NULL,
      date_to TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_teacher_absences_dates ON teacher_absences(date_from, date_to);

    CREATE TABLE IF NOT EXISTS conversation_favorites (
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      PRIMARY KEY (conversation_id, account_id)
    );
  `);
}
