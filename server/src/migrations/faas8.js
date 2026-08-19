/**
 * FAAS 8 — läbiv AI-mootor.
 *
 * `ai_usage` ei ole analüütikatabel, vaid vastavusnõue. AI-määruse kõrge riski
 * kohustuste hulgas on logimine ja inimjärelevalve: peab olema võimalik
 * tagantjärele näidata, millal AI-d kasutati, mis otstarbel ja kes selle
 * käivitas. Ilma selleta ei ole "inimene otsustab" tõestatav, vaid ainult
 * väidetav.
 *
 * Sisu ise siia EI salvestata — logi ütleb, ET kutse tehti, mitte mida
 * kirjutati. Prompt võib sisaldada õpilase andmeid ja selle säilitamine
 * teeks logist uue isikuandmete hoidla.
 */
export function runFaas8Migration(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
      account_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      purpose TEXT NOT NULL,
      model TEXT,
      ok INTEGER NOT NULL DEFAULT 1,
      error_kind TEXT,
      input_chars INTEGER,
      output_chars INTEGER,
      duration_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ai_usage_school ON ai_usage(school_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_purpose ON ai_usage(purpose);
  `);
}
