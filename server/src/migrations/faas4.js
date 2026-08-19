/**
 * FAAS 4 — sõnumid.
 *
 * Puhtalt lisav.
 *
 * Kaks vestlusetüüpi, mis käituvad erinevalt:
 *  - `direct` — kindlate inimeste vahel, osalejad on tabelis kirjas
 *  - `class_announcement` — klassi teade, mille nähtavus tuleb klassist endast.
 *    Osalejaid EI materialiseerita: kui uus lapsevanem liitub hiljem, peab ta
 *    nägema ka varasemaid teateid. Osalejate tabeliga jääksid need nägemata.
 *
 * Lugemisseis (`conversation_reads`) on mõlemal tüübil ühine.
 */
export function runFaas4Migration(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
      class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
      student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
      kind TEXT NOT NULL DEFAULT 'direct'
        CHECK (kind IN ('direct', 'class_announcement')),
      subject TEXT,
      created_by INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_message_at TEXT
    );

    CREATE TABLE IF NOT EXISTS conversation_participants (
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      PRIMARY KEY (conversation_id, account_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversation_reads (
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      last_read_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (conversation_id, account_id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, id);
    CREATE INDEX IF NOT EXISTS idx_conversations_class ON conversations(class_id, kind);
    CREATE INDEX IF NOT EXISTS idx_participants_account ON conversation_participants(account_id);
  `);
}
