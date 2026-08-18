/**
 * FAAS 2 — tunniplaan, asendused, eksamid ja lapsevanema päev.
 *
 * Puhtalt lisav: uued tabelid, olemasolevaid ei puudutata.
 *
 * UNIQUE-piirangute juures on siin sama õppetund, mis Faas 1b-s: kõik
 * piirangus osalevad veerud on NOT NULL, sest SQLite loeb NULL-e UNIQUE-is
 * erinevaks ja nullitav veerg muudaks piirangu kasutuks.
 */
export function runFaas2Migration(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS timetable_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      teacher_id INTEGER REFERENCES teachers(id),
      room TEXT,
      day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
      lesson_number INTEGER NOT NULL CHECK (lesson_number BETWEEN 1 AND 12),
      start_time TEXT,
      end_time TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(class_id, day_of_week, lesson_number)
    );

    CREATE TABLE IF NOT EXISTS substitutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timetable_entry_id INTEGER NOT NULL REFERENCES timetable_entries(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      substitute_teacher_id INTEGER REFERENCES teachers(id),
      new_room TEXT,
      cancelled INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      created_by INTEGER REFERENCES teachers(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(timetable_entry_id, date)
    );

    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      title TEXT,
      date TEXT NOT NULL,
      created_by INTEGER REFERENCES teachers(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    /* Lapsevanema päeva ajapesad. Broneerija on vanema konto (teachers-tabelis). */
    CREATE TABLE IF NOT EXISTS parent_meeting_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 15,
      booked_by INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      booked_student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
      booked_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(teacher_id, date, start_time)
    );

    CREATE INDEX IF NOT EXISTS idx_timetable_class ON timetable_entries(class_id, day_of_week);
    CREATE INDEX IF NOT EXISTS idx_substitutions_date ON substitutions(date);
    CREATE INDEX IF NOT EXISTS idx_exams_class_date ON exams(class_id, date);
    CREATE INDEX IF NOT EXISTS idx_meeting_slots_date ON parent_meeting_slots(date);
  `);
}
