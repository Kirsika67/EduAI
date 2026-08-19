/**
 * FAAS 5 — mentorlus.
 *
 * Juhend tahtis uusi tabeleid `mentoring_goals` ja `mentoring_checkins`. Koodis
 * on juba `student_goals` ja `mentor_notes` andmetega sees. Kaks paralleelset
 * tabelipaari sama asja jaoks tähendaks, et pool eesmärkidest oleks ühes ja
 * pool teises — seega laiendame olemasolevaid (vt K2).
 *
 * Ainult veergude lisamine, tabeleid ümber ei ehitata.
 */

function columnNames(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

function addColumn(db, table, name, definition) {
  if (columnNames(db, table).includes(name)) return false;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  return true;
}

export function runFaas5Migration(db) {
  const notes = [];

  /**
   * Eesmärgid on ühised: laps peab neid nägema, muidu ei ole need tema
   * eesmärgid, vaid õpetaja märkmed tema kohta.
   */
  const goalCols = [
    addColumn(db, "student_goals", "category", "TEXT"),
    addColumn(db, "student_goals", "target_date", "TEXT"),
    addColumn(db, "student_goals", "mentor_id", "INTEGER REFERENCES teachers(id)"),
    addColumn(db, "student_goals", "progress", "INTEGER NOT NULL DEFAULT 0"),
    addColumn(db, "student_goals", "detail", "TEXT"),
    addColumn(db, "student_goals", "updated_at", "TEXT"),
  ].filter(Boolean).length;
  if (goalCols) notes.push(`student_goals: ${goalCols} uut veergu`);

  /**
   * Mentorimärkmed on VAIKIMISI PRIVAATSED — vastupidiselt käitumismärkustele.
   * Käitumismärkus on fakt lapse tegevuse kohta, mida vanemal on õigus teada.
   * Mentorivestluses võib laps aga usaldada midagi isiklikku; kui see läheks
   * vaikimisi vanemale, ei räägiks ükski laps enam midagi. Jagamine on siin
   * teadlik valik, mitte vaikeseade.
   */
  const noteCols = [
    addColumn(db, "mentor_notes", "mentor_id", "INTEGER REFERENCES teachers(id)"),
    addColumn(db, "mentor_notes", "kind", "TEXT NOT NULL DEFAULT 'check_in'"),
    addColumn(db, "mentor_notes", "is_private", "INTEGER NOT NULL DEFAULT 1"),
    addColumn(db, "mentor_notes", "next_meeting_date", "TEXT"),
    addColumn(db, "mentor_notes", "date", "TEXT"),
  ].filter(Boolean).length;
  if (noteCols) notes.push(`mentor_notes: ${noteCols} uut veergu`);

  /** Vanadel märkmetel pole kuupäeva — võtame selle loomisajast. */
  const missingDate = db
    .prepare(`SELECT COUNT(*) AS n FROM mentor_notes WHERE date IS NULL`)
    .get().n;
  if (missingDate > 0) {
    db.exec(`UPDATE mentor_notes SET date = substr(created_at, 1, 10) WHERE date IS NULL`);
    notes.push(`mentor_notes: ${missingDate} vanale märkmele lisatud kuupäev`);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_goals_mentor ON student_goals(mentor_id);
    CREATE INDEX IF NOT EXISTS idx_mentor_notes_date ON mentor_notes(student_id, date);
  `);

  return { changed: notes.length > 0, notes };
}
