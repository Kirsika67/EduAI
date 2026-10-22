/**
 * FAAS 9 — ülesanded ja kodutööd.
 *
 * Puhtalt lisav: üks uus tabel. Ülesanne kuulub klassile; kes klassi näeb
 * (õpetaja, vanem, õpilane), näeb ka selle ülesandeid.
 */
export function runFaas9Migration(db) {
  /**
   * materials.type CHECK ei luba uut tüüpi 'theory' (teooria / reeglivihik).
   * SQLite ei saa CHECK-i muuta, seega ehitatakse tabel ümber — ainult üks kord.
   */
  const existing = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'materials'`).get();
  if (existing && !existing.sql.includes("'theory'")) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE materials_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK (type IN ('worksheet', 'test', 'lesson_plan', 'theory')),
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO materials_new (id, class_id, type, title, content, created_at)
          SELECT id, class_id, type, title, content, created_at FROM materials;
        DROP TABLE materials;
        ALTER TABLE materials_new RENAME TO materials;
        CREATE INDEX IF NOT EXISTS idx_materials_class ON materials(class_id);
      `);
    })();
  }

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

    CREATE TABLE IF NOT EXISTS lesson_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      created_by INTEGER REFERENCES teachers(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_lesson_plans_class_date ON lesson_plans(class_id, date);

    CREATE TABLE IF NOT EXISTS planner_chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      messages TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_planner_chats_account ON planner_chats(account_id, updated_at);

    CREATE TABLE IF NOT EXISTS automations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      config TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_automations_account ON automations(account_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      automation_id INTEGER REFERENCES automations(id) ON DELETE SET NULL,
      kind TEXT NOT NULL DEFAULT 'automation',
      title TEXT NOT NULL,
      body TEXT,
      link TEXT,
      dedupe_key TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      read_at TEXT,
      UNIQUE(account_id, dedupe_key)
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_account ON notifications(account_id, created_at);

    CREATE TABLE IF NOT EXISTS conversation_favorites (
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      PRIMARY KEY (conversation_id, account_id)
    );
  `);
}
