import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { visibleClassIds, canAccessStudent } from "../services/access.js";
import { assistMessage, ASSIST_MODES } from "../services/messageAssist.js";
import { ROLES, isStaff, roleLabel } from "../constants/roles.js";

const router = Router();
router.use(requireAuth);

/**
 * Kas kasutaja näeb seda vestlust.
 *
 * `direct` — peab olema osalejate nimekirjas. Kooli juhtkonnale erandit EI ole:
 * õpetaja ja lapsevanema kirjavahetus ei ole juhtkonna jaoks vaikimisi avatud.
 * `class_announcement` — nähtav kõigile, kes seda klassi näevad.
 */
function canSeeConversation(user, conv) {
  if (conv.kind === "class_announcement") {
    return visibleClassIds(user).includes(Number(conv.class_id));
  }
  const row = db
    .prepare(
      `SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND account_id = ?`
    )
    .get(conv.id, user.id);
  return Boolean(row);
}

/** Kes tohib sellesse vestlusesse kirjutada. Teated on ühesuunalised. */
function canPostTo(user, conv) {
  if (conv.kind === "class_announcement") return isStaff(user.role);
  return canSeeConversation(user, conv);
}

function loadConversation(id) {
  return db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(Number(id));
}

function touch(conversationId) {
  db.prepare(`UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?`).run(
    conversationId
  );
}

/* ---------------- Vestluste nimekiri ---------------- */

router.get("/", (req, res) => {
  const classIds = visibleClassIds(req.user);
  const params = [req.user.id];
  let where = `c.id IN (SELECT conversation_id FROM conversation_participants WHERE account_id = ?)`;

  if (classIds.length) {
    where += ` OR (c.kind = 'class_announcement' AND c.class_id IN (${classIds
      .map(() => "?")
      .join(", ")}))`;
    params.push(...classIds);
  }

  const rows = db
    .prepare(
      `SELECT c.*, cl.name AS class_name, st.name AS student_name,
              (SELECT body FROM messages m WHERE m.conversation_id = c.id
                ORDER BY m.id DESC LIMIT 1) AS last_body,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count,
              (SELECT COUNT(*) FROM messages m
                WHERE m.conversation_id = c.id
                  AND m.sender_id != ?
                  AND m.created_at > COALESCE(
                    (SELECT last_read_at FROM conversation_reads r
                      WHERE r.conversation_id = c.id AND r.account_id = ?), '')) AS unread
       FROM conversations c
       LEFT JOIN classes cl ON cl.id = c.class_id
       LEFT JOIN students st ON st.id = c.student_id
       WHERE ${where}
       ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
       LIMIT 100`
    )
    .all(req.user.id, req.user.id, ...params);

  const participantsOf = db.prepare(
    `SELECT t.id, t.name, t.role FROM conversation_participants p
     JOIN teachers t ON t.id = p.account_id
     WHERE p.conversation_id = ?`
  );

  res.json({
    conversations: rows.map((c) => ({
      id: c.id,
      kind: c.kind,
      subject: c.subject,
      className: c.class_name,
      studentName: c.student_name,
      lastBody: c.last_body,
      messageCount: c.message_count,
      unread: c.unread,
      lastMessageAt: c.last_message_at || c.created_at,
      participants: participantsOf
        .all(c.id)
        .filter((p) => Number(p.id) !== Number(req.user.id))
        .map((p) => ({ id: p.id, name: p.name, roleLabel: roleLabel(p.role) })),
    })),
  });
});

/** Kellega saab uut vestlust alustada. */
router.get("/contacts", (req, res) => {
  const classIds = visibleClassIds(req.user);
  if (!classIds.length) return res.json({ contacts: [] });

  let rows;
  if (isStaff(req.user.role)) {
    /** Õpetaja näeb oma klasside lapsevanemaid ja õpilaskontosid. */
    rows = db
      .prepare(
        `SELECT DISTINCT t.id, t.name, t.role, s.name AS student_name, s.id AS student_id
         FROM teachers t
         LEFT JOIN parent_student_links l ON l.parent_id = t.id
         LEFT JOIN students s ON s.id = COALESCE(l.student_id, t.linked_student_id)
         WHERE t.role IN ('parent', 'student')
           AND s.class_id IN (${classIds.map(() => "?").join(", ")})
         ORDER BY t.name COLLATE NOCASE`
      )
      .all(...classIds);
  } else {
    /** Vanem ja õpilane näevad oma klasside koolitöötajaid. */
    rows = db
      .prepare(
        `SELECT DISTINCT t.id, t.name, t.role, NULL AS student_name, NULL AS student_id
         FROM teachers t
         JOIN classes c ON c.teacher_id = t.id
         WHERE c.id IN (${classIds.map(() => "?").join(", ")})
         ORDER BY t.name COLLATE NOCASE`
      )
      .all(...classIds);
  }

  res.json({
    contacts: rows
      .filter((r) => Number(r.id) !== Number(req.user.id))
      .map((r) => ({
        id: r.id,
        name: r.name,
        roleLabel: roleLabel(r.role),
        studentName: r.student_name,
        studentId: r.student_id,
      })),
  });
});

/* ---------------- Ühe vestluse sõnumid ---------------- */

router.get("/:id", (req, res) => {
  const conv = loadConversation(req.params.id);
  if (!conv || !canSeeConversation(req.user, conv)) {
    return res.status(404).json({ error: "Vestlust ei leitud." });
  }

  const messages = db
    .prepare(
      `SELECT m.id, m.body, m.created_at, m.sender_id, t.name AS sender_name, t.role AS sender_role
       FROM messages m
       JOIN teachers t ON t.id = m.sender_id
       WHERE m.conversation_id = ?
       ORDER BY m.id`
    )
    .all(conv.id);

  db.prepare(
    `INSERT INTO conversation_reads (conversation_id, account_id, last_read_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(conversation_id, account_id) DO UPDATE SET last_read_at = datetime('now')`
  ).run(conv.id, req.user.id);

  res.json({
    conversation: {
      id: conv.id,
      kind: conv.kind,
      subject: conv.subject,
      canPost: canPostTo(req.user, conv),
    },
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.created_at,
      senderName: m.sender_name,
      senderRoleLabel: roleLabel(m.sender_role),
      isMine: Number(m.sender_id) === Number(req.user.id),
    })),
  });
});

/* ---------------- Vestluse alustamine ---------------- */

router.post("/", (req, res) => {
  const kind = req.body?.kind === "class_announcement" ? "class_announcement" : "direct";
  const body = String(req.body?.body || "").trim();
  const subject = req.body?.subject ? String(req.body.subject).slice(0, 160) : null;

  if (!body) return res.status(400).json({ error: "Kirjuta sõnum." });

  if (kind === "class_announcement") {
    if (!isStaff(req.user.role)) {
      return res.status(403).json({ error: "Teate saab saata koolitöötaja." });
    }
    const classId = Number(req.body?.classId);
    if (!visibleClassIds(req.user).includes(classId)) {
      return res.status(404).json({ error: "Klassi ei leitud." });
    }

    const info = db
      .prepare(
        `INSERT INTO conversations (school_id, class_id, kind, subject, created_by, last_message_at)
         VALUES (?, ?, 'class_announcement', ?, ?, datetime('now'))`
      )
      .run(req.user.schoolId, classId, subject, req.user.id);
    db.prepare(`INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)`).run(
      info.lastInsertRowid,
      req.user.id,
      body.slice(0, 4000)
    );

    audit(req, {
      action: "message.announcement",
      entityType: "conversation",
      entityId: info.lastInsertRowid,
    });
    return res.status(201).json({ id: info.lastInsertRowid });
  }

  const recipientId = Number(req.body?.recipientId);
  const recipient = db
    .prepare(`SELECT id, role, school_id FROM teachers WHERE id = ?`)
    .get(recipientId);
  if (!recipient) return res.status(404).json({ error: "Saajat ei leitud." });
  if (Number(recipient.school_id) !== Number(req.user.schoolId)) {
    return res.status(404).json({ error: "Saajat ei leitud." });
  }
  /** Vanem ja õpilane kirjutavad koolitöötajale, mitte üksteisele. */
  if (!isStaff(req.user.role) && !isStaff(recipient.role)) {
    return res.status(403).json({ error: "Sõnumi saab saata koolitöötajale." });
  }

  const studentId = req.body?.studentId ? Number(req.body.studentId) : null;
  if (studentId !== null && !canAccessStudent(req.user, studentId)) {
    return res.status(404).json({ error: "Õpilast ei leitud." });
  }

  /** Sama paari vahel ei looda uut lõime, kui üks on juba olemas. */
  const existing = db
    .prepare(
      `SELECT c.id FROM conversations c
       WHERE c.kind = 'direct'
         AND (SELECT COUNT(*) FROM conversation_participants p WHERE p.conversation_id = c.id) = 2
         AND EXISTS (SELECT 1 FROM conversation_participants p WHERE p.conversation_id = c.id AND p.account_id = ?)
         AND EXISTS (SELECT 1 FROM conversation_participants p WHERE p.conversation_id = c.id AND p.account_id = ?)
       LIMIT 1`
    )
    .get(req.user.id, recipientId);

  const conversationId = existing
    ? existing.id
    : db
        .prepare(
          `INSERT INTO conversations (school_id, student_id, kind, subject, created_by, last_message_at)
           VALUES (?, ?, 'direct', ?, ?, datetime('now'))`
        )
        .run(req.user.schoolId, studentId, subject, req.user.id).lastInsertRowid;

  db.transaction(() => {
    if (!existing) {
      const addPart = db.prepare(
        `INSERT OR IGNORE INTO conversation_participants (conversation_id, account_id) VALUES (?, ?)`
      );
      addPart.run(conversationId, req.user.id);
      addPart.run(conversationId, recipientId);
    }
    db.prepare(`INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)`).run(
      conversationId,
      req.user.id,
      body.slice(0, 4000)
    );
    touch(conversationId);
  })();

  audit(req, {
    action: "message.send",
    entityType: "conversation",
    entityId: conversationId,
    studentId,
  });
  res.status(201).json({ id: conversationId });
});

/* ---------------- Vastamine ---------------- */

router.post("/:id/messages", (req, res) => {
  const conv = loadConversation(req.params.id);
  if (!conv || !canSeeConversation(req.user, conv)) {
    return res.status(404).json({ error: "Vestlust ei leitud." });
  }
  if (!canPostTo(req.user, conv)) {
    return res.status(403).json({ error: "Sellesse vestlusesse ei saa vastata." });
  }

  const body = String(req.body?.body || "").trim();
  if (!body) return res.status(400).json({ error: "Kirjuta sõnum." });

  const info = db
    .prepare(`INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)`)
    .run(conv.id, req.user.id, body.slice(0, 4000));
  touch(conv.id);

  audit(req, {
    action: "message.send",
    entityType: "conversation",
    entityId: conv.id,
    studentId: conv.student_id,
  });
  res.status(201).json({ id: info.lastInsertRowid });
});

/* ---------------- AI abi sõnastamisel ---------------- */

router.get("/assist/modes", requireStaff, (_req, res) => {
  res.json({
    modes: Object.entries(ASSIST_MODES).map(([value, m]) => ({ value, label: m.label })),
  });
});

/**
 * Tagastab ettepaneku, EI saada midagi. Saatmine on eraldi kutse, mille teeb
 * inimene pärast teksti nägemist (RULE A1).
 */
router.post("/assist", requireStaff, async (req, res) => {
  const text = String(req.body?.text || "").trim();
  const mode = String(req.body?.mode || "");
  if (!text) return res.status(400).json({ error: "Kirjuta esmalt sõnum." });
  if (text.length > 4000) return res.status(400).json({ error: "Sõnum on liiga pikk." });

  const result = await assistMessage(text, mode, process.env.ANTHROPIC_API_KEY);
  if (result.error) return res.status(400).json({ error: result.error });

  audit(req, { action: `message.ai_assist:${mode}`, entityType: "message" });
  res.json({ suggestion: result.text, fallback: result.fallback || null });
});

export default router;
