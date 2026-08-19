/**
 * FAAS 7 — huviringid.
 *
 * Puhtalt lisav.
 *
 * `activity_participants` primaarvõti on (activity_id, student_id) — sama laps
 * ei saa olla samas ringis kaks korda. Kohtade piirangut EI saa panna
 * andmebaasi piiranguks (SQLite ei tunne "mitte üle N rea kohta"), seega on
 * see tingimuslik INSERT marsruudis; vt routes/activities.js.
 */
export function runFaas7Migration(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      leader_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7),
      start_time TEXT,
      location TEXT,
      max_participants INTEGER,
      is_open INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_participants (
      activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      added_by INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (activity_id, student_id)
    );

    CREATE INDEX IF NOT EXISTS idx_activities_school ON activities(school_id);
    CREATE INDEX IF NOT EXISTS idx_activity_participants_student
      ON activity_participants(student_id);
  `);
}
