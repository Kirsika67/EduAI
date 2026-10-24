/**
 * FAAS 10 — selgitatav varajane hoiatus.
 *
 * Puhtalt lisav: õpetaja enda hoiatuspiirid ja tagasiside ("oli risk / ei olnud"),
 * et hiljem saaks hoiatuste täpsust võrrelda.
 */
export function runFaas10Migration(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS risk_settings (
      account_id INTEGER PRIMARY KEY REFERENCES teachers(id) ON DELETE CASCADE,
      config TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS risk_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      level TEXT NOT NULL,
      reasons TEXT NOT NULL DEFAULT '[]',
      verdict TEXT NOT NULL CHECK (verdict IN ('was_risk', 'not_risk')),
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_risk_feedback_student ON risk_feedback(student_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_risk_feedback_account ON risk_feedback(account_id, created_at);
  `);
}
