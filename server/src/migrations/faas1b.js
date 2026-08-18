/**
 * FAAS 1b — kohaloleku, käitumise ja heaolu andmemudeli laiendus.
 *
 * See on plaani ainus migratsioon, mis ehitab ümber tabeli, kus on päris andmeid.
 * Põhjus: `attendance` piirang UNIQUE(student_id, date) lubab ainult ÜHT kirjet
 * päevas, aga tunnipõhine kohalolek vajab UNIQUE(student_id, date, lesson_number).
 * SQLite ei oska piirangut muuta — tabel tuleb uuesti ehitada ja read üle kopeerida.
 *
 * Vt docs/ARHITEKTUUR_JA_PLAAN.md punkt K2.
 */

/** Vana `mood` → juhendi 1–5 skaala. Kolm väärtust mahuvad skaala keskele. */
const MOOD_TO_VALUE = { hard: 2, ok: 3, good: 4 };

function columnNames(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

function addColumn(db, table, name, definition) {
  if (columnNames(db, table).includes(name)) return false;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  return true;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @returns {{ changed: boolean, notes: string[] }}
 */
export function runFaas1bMigration(db) {
  const notes = [];
  let changed = false;

  /* ---------- 1. attendance: tabeli ümberehitus ---------- */

  if (!columnNames(db, "attendance").includes("lesson_number")) {
    const before = db.prepare(`SELECT COUNT(*) AS n FROM attendance`).get().n;

    /**
     * `lesson_number` on NOT NULL DEFAULT 0, MITTE nullitav. SQLite loeb NULL-e
     * UNIQUE-piirangus erinevaks, seega nullitava veeruga ei väldiks piirang
     * ühtegi duplikaati. 0 tähendab "terve päev" — vanad kirjed saavad selle.
     */
    db.pragma("foreign_keys = OFF");
    try {
      db.transaction(() => {
        db.exec(`
          CREATE TABLE attendance__faas1b (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
            class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
            date TEXT NOT NULL,
            lesson_number INTEGER NOT NULL DEFAULT 0,
            subject TEXT,
            status TEXT NOT NULL CHECK (status IN ('present', 'late', 'absent', 'excused')),
            reason TEXT,
            notes TEXT,
            reported_by TEXT NOT NULL DEFAULT 'teacher'
              CHECK (reported_by IN ('teacher', 'parent', 'system')),
            confirmed INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(student_id, date, lesson_number)
          );
        `);

        /** class_id tuletatakse õpilase klassist — vanadel ridadel seda ei olnud. */
        db.exec(`
          INSERT INTO attendance__faas1b
            (id, student_id, class_id, date, lesson_number, status, notes, created_at)
          SELECT a.id, a.student_id, s.class_id, a.date, 0, a.status, a.notes, a.created_at
          FROM attendance a
          JOIN students s ON s.id = a.student_id;
        `);

        const copied = db
          .prepare(`SELECT COUNT(*) AS n FROM attendance__faas1b`)
          .get().n;
        if (copied !== before) {
          throw new Error(
            `attendance migratsioon: ridu enne ${before}, kopeeriti ${copied} — katkestan.`
          );
        }

        db.exec(`DROP TABLE attendance;`);
        db.exec(`ALTER TABLE attendance__faas1b RENAME TO attendance;`);
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
          CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, date);
          CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
        `);
      })();
    } finally {
      db.pragma("foreign_keys = ON");
    }

    const violations = db.pragma("foreign_key_check");
    if (violations.length) {
      throw new Error(
        `attendance migratsioon jättis katkised viited: ${JSON.stringify(violations)}`
      );
    }

    const after = db.prepare(`SELECT COUNT(*) AS n FROM attendance`).get().n;
    notes.push(`attendance ümber ehitatud, ridu ${before} → ${after}`);
    changed = true;
  }

  /* ---------- 2. behavior_notes: lisaveerud ---------- */

  /**
   * `kind` (positive/concern/incident) JÄÄB ALLES — ABC-riskimudel sõltub
   * 'incident' väärtusest. Juhendi `sentiment` tuletatakse `kind`-ist, uut
   * veergu ei lisata (vt K2).
   */
  const behaviorAdded = [
    addColumn(db, "behavior_notes", "category", "TEXT"),
    addColumn(db, "behavior_notes", "teacher_id", "INTEGER REFERENCES teachers(id)"),
    addColumn(db, "behavior_notes", "is_private", "INTEGER NOT NULL DEFAULT 1"),
  ].filter(Boolean).length;

  if (behaviorAdded) {
    notes.push(`behavior_notes: ${behaviorAdded} uut veergu`);
    changed = true;
  }

  /* ---------- 3. wellbeing_checkins: 1–5 skaala ---------- */

  if (addColumn(db, "wellbeing_checkins", "mood_value", "INTEGER")) {
    const update = db.prepare(
      `UPDATE wellbeing_checkins SET mood_value = ? WHERE mood = ? AND mood_value IS NULL`
    );
    db.transaction(() => {
      for (const [mood, value] of Object.entries(MOOD_TO_VALUE)) {
        update.run(value, mood);
      }
    })();
    const filled = db
      .prepare(`SELECT COUNT(*) AS n FROM wellbeing_checkins WHERE mood_value IS NOT NULL`)
      .get().n;
    notes.push(`wellbeing_checkins: mood_value lisatud, täidetud ${filled} rida`);
    changed = true;
  }

  return { changed, notes };
}
