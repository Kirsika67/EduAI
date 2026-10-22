import db from "../db.js";
import { askClaude } from "./aiEngine.js";
import { sendWebhook } from "./webhook.js";

/**
 * Automatsioonid: õpetaja seab reegli, server kontrollib seda ise (iga 10 min) ja
 * teeb vajaduse korral teavituse. Iga reegli kohta on "dedupe_key", et sama asi ei
 * teavitaks mitu korda.
 */

export const AUTOMATION_TYPES = {
  grade_drop: {
    label: "Õpilase tulemused langevad",
    description: "Teavitab, kui õpilase viimase 5 hinde keskmine on alla valitud piiri.",
    defaults: { threshold: 50 },
  },
  deadline_reminder: {
    label: "Tähtaja meeldetuletus",
    description: "Teavitab, kui kodutöö, ülesande või kontrolltöö tähtaeg läheneb. Soovi korral saadab teate ka klassile.",
    defaults: { daysBefore: 1, announce: false },
  },
  weekly_summary: {
    label: "AI nädalakokkuvõte",
    description: "Koostab AI abil valitud nädalapäeval kokkuvõtte klassi hinnetest ja eelseisvast.",
    defaults: { weekday: 5 },
  },
  no_grades: {
    label: "Hinded on lisamata",
    description: "Tuletab meelde, kui klassi pole mitu päeva hindeid lisatud.",
    defaults: { days: 14 },
  },
};

const TZ = "Europe/Tallinn";
const WEEKDAY_NUM = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function tallinnNow(date = new Date()) {
  const s = date.toLocaleString("sv-SE", { timeZone: TZ }); // "YYYY-MM-DD HH:MM:SS"
  const wd = date.toLocaleDateString("en-US", { timeZone: TZ, weekday: "short" });
  return { date: s.slice(0, 10), hour: Number(s.slice(11, 13)), weekday: WEEKDAY_NUM[wd] || 1 };
}

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Nädala tähis (esmaspäeva kuupäev), et "kord nädalas" dedupe töötaks. */
function weekKey(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
}

const insertNote = db.prepare(
  `INSERT OR IGNORE INTO notifications (account_id, automation_id, title, body, link, dedupe_key)
   VALUES (?, ?, ?, ?, ?, ?)`
);

function notify(auto, { title, body, link, key, force }) {
  const dedupe = force ? `${key}:force:${Date.now()}` : key;
  const changes = insertNote.run(auto.account_id, auto.id, title, body || null, link || null, dedupe).changes;
  if (changes) {
    /** Webhook (nt n8n) ei oota: viga ei tohi automatsiooni peatada. */
    sendWebhook(auto.account_id, {
      event: "automation",
      type: auto.type,
      title,
      body: body || null,
      link: link || null,
      createdAt: new Date().toISOString(),
    }).catch(() => {});
  }
  return changes;
}

function classesFor(auto) {
  if (auto.class_id) {
    const c = db.prepare(`SELECT id, name, subject FROM classes WHERE id = ? AND teacher_id = ?`).get(auto.class_id, auto.account_id);
    return c ? [c] : [];
  }
  return db.prepare(`SELECT id, name, subject FROM classes WHERE teacher_id = ?`).all(auto.account_id);
}

/* ---------- Reeglite tüübid ---------- */

function runGradeDrop(auto, cfg, now, force) {
  const threshold = Math.min(95, Math.max(10, Number(cfg.threshold) || 50));
  let created = 0;
  for (const cls of classesFor(auto)) {
    const students = db.prepare(`SELECT id, name FROM students WHERE class_id = ?`).all(cls.id);
    const low = [];
    for (const s of students) {
      const rows = db.prepare(`SELECT score FROM grades WHERE student_id = ? ORDER BY date DESC, id DESC LIMIT 5`).all(s.id);
      if (rows.length < 2) continue;
      const avg = Math.round(rows.reduce((t, r) => t + Number(r.score), 0) / rows.length);
      if (avg < threshold) low.push(`${s.name} (${avg}%)`);
    }
    if (!low.length) continue;
    created += notify(auto, {
      title: `${cls.name}: ${low.length} õpilase viimased tulemused on alla ${threshold}%`,
      body: low.join(", "),
      link: "/opilased",
      key: `grade_drop:${auto.id}:${cls.id}:${weekKey(now.date)}`,
      force,
    });
  }
  return created;
}

function runDeadline(auto, cfg, now, force) {
  const daysBefore = [1, 2, 3, 7].includes(Number(cfg.daysBefore)) ? Number(cfg.daysBefore) : 1;
  const target = addDays(now.date, daysBefore);
  let created = 0;
  for (const cls of classesFor(auto)) {
    const items = [
      ...db.prepare(`SELECT title, subject, kind FROM assignments WHERE class_id = ? AND due_date = ?`).all(cls.id, target)
        .map((a) => `${a.kind === "task" ? "Ülesanne" : "Kodutöö"}: ${a.title} (${a.subject})`),
      ...db.prepare(`SELECT title, subject FROM exams WHERE class_id = ? AND date = ?`).all(cls.id, target)
        .map((e) => `Kontrolltöö: ${e.title || e.subject}`),
    ];
    if (!items.length) continue;
    const when = daysBefore === 1 ? "homme" : `${daysBefore} päeva pärast`;
    const note = notify(auto, {
      title: `${cls.name}: tähtaeg ${when}`,
      body: items.join("; "),
      link: "/paevik",
      key: `deadline:${auto.id}:${cls.id}:${target}`,
      force,
    });
    created += note;
    if (note && cfg.announce) {
      const teacher = db.prepare(`SELECT school_id FROM teachers WHERE id = ?`).get(auto.account_id);
      const info = db
        .prepare(
          `INSERT INTO conversations (school_id, class_id, kind, subject, created_by, last_message_at)
           VALUES (?, ?, 'class_announcement', ?, ?, datetime('now'))`
        )
        .run(teacher?.school_id ?? null, cls.id, `Meeldetuletus: tähtaeg ${when}`, auto.account_id);
      db.prepare(`INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)`).run(
        info.lastInsertRowid,
        auto.account_id,
        `Tere! Meeldetuletus: ${when} (${target}) on tähtaeg.\n\n- ${items.join("\n- ")}`
      );
    }
  }
  return created;
}

async function runWeekly(auto, cfg, now, force) {
  let created = 0;
  for (const cls of classesFor(auto)) {
    const since = addDays(now.date, -7);
    const stats = db
      .prepare(`SELECT COUNT(*) AS n, ROUND(AVG(g.score)) AS avg FROM grades g JOIN students s ON s.id = g.student_id WHERE s.class_id = ? AND g.date >= ?`)
      .get(cls.id, since);
    const lowCount = db
      .prepare(
        `SELECT COUNT(*) AS n FROM (SELECT s.id FROM students s JOIN grades g ON g.student_id = s.id
           WHERE s.class_id = ? GROUP BY s.id HAVING AVG(g.score) < 50)`
      )
      .get(cls.id).n;
    const exams = db.prepare(`SELECT title, subject, date FROM exams WHERE class_id = ? AND date BETWEEN ? AND ? ORDER BY date`).all(cls.id, now.date, addDays(now.date, 7))
      .map((e) => `${e.date}: ${e.title || e.subject}`);
    const due = db.prepare(`SELECT title, due_date FROM assignments WHERE class_id = ? AND due_date BETWEEN ? AND ? ORDER BY due_date`).all(cls.id, now.date, addDays(now.date, 7))
      .map((a) => `${a.due_date}: ${a.title}`);
    const facts = {
      klass: `${cls.name} ${cls.subject}`,
      viimase7paevaHindeid: stats.n,
      viimase7paevaKeskmineProtsent: stats.avg,
      oppilasiKeskmiseAlla50: lowCount,
      eelseisvadKontrolltood: exams,
      eelseisvadTahtajad: due,
    };
    const ai = await askClaude({
      purpose: "automation_summary",
      maxTokens: 500,
      prompt:
        "Kirjuta eesti keeles õpetajale 4–6 lauset nädalakokkuvõtet selle klassi kohta ainult allolevate faktide põhjal. Too välja, mis läks hästi, mis vajab tähelepanu ja mis on eelseisval nädalal. Ära kasuta pealkirju ega loetelu, ära mõtle andmeid juurde.\n\nFaktid:\n" + JSON.stringify(facts),
    });
    const text =
      ai.text ||
      `Nädala hindeid: ${stats.n}${stats.avg != null ? `, keskmine ${stats.avg}%` : ""}. Eelseisvaid kontrolltöid: ${exams.length}, tähtaegu: ${due.length}.`;
    created += notify(auto, {
      title: `${cls.name}: nädalakokkuvõte`,
      body: text,
      link: "/paevik",
      key: `weekly:${auto.id}:${cls.id}:${weekKey(now.date)}`,
      force,
    });
  }
  return created;
}

function runNoGrades(auto, cfg, now, force) {
  const days = Math.min(90, Math.max(3, Number(cfg.days) || 14));
  const cutoff = addDays(now.date, -days);
  let created = 0;
  for (const cls of classesFor(auto)) {
    const hasStudents = db.prepare(`SELECT 1 FROM students WHERE class_id = ? LIMIT 1`).get(cls.id);
    if (!hasStudents) continue;
    const last = db.prepare(`SELECT MAX(g.date) AS d FROM grades g JOIN students s ON s.id = g.student_id WHERE s.class_id = ?`).get(cls.id).d;
    if (last && String(last).slice(0, 10) >= cutoff) continue;
    created += notify(auto, {
      title: `${cls.name}: hindeid pole lisatud ${days}+ päeva`,
      body: last ? `Viimane hinne on ${String(last).slice(0, 10)}.` : "Ühtegi hinnet pole veel lisatud.",
      link: "/hinded",
      key: `no_grades:${auto.id}:${cls.id}:${weekKey(now.date)}`,
      force,
    });
  }
  return created;
}

/** Kas reegel peaks praegu kontrollima (kellaaja piirang). */
function due(type, cfg, now) {
  if (type === "weekly_summary") return now.weekday === Number(cfg.weekday || 5) && now.hour >= 16;
  return now.hour >= 7;
}

/**
 * Käivitab ühe automatsiooni. `force` = käsitsi "Käivita nüüd": ignoreerib kellaaega ja
 * dedupe'i, et saaks reeglit kohe proovida.
 */
export async function runAutomation(auto, { force = false } = {}) {
  const cfg = (() => { try { return JSON.parse(auto.config || "{}"); } catch { return {}; } })();
  const now = tallinnNow();
  if (!force && !due(auto.type, cfg, now)) return 0;

  let created = 0;
  try {
    if (auto.type === "grade_drop") created = runGradeDrop(auto, cfg, now, force);
    else if (auto.type === "deadline_reminder") created = runDeadline(auto, cfg, now, force);
    else if (auto.type === "weekly_summary") created = await runWeekly(auto, cfg, now, force);
    else if (auto.type === "no_grades") created = runNoGrades(auto, cfg, now, force);
  } catch (err) {
    console.error(`[automatsioon ${auto.id}]`, err.message);
  }
  db.prepare(`UPDATE automations SET last_run_at = datetime('now') WHERE id = ?`).run(auto.id);
  return created;
}

export async function runAllAutomations() {
  const autos = db.prepare(`SELECT * FROM automations WHERE enabled = 1`).all();
  for (const a of autos) await runAutomation(a);
}

export function startAutomationScheduler() {
  const tick = () => runAllAutomations().catch((e) => console.error("[automatsioonid]", e.message));
  setTimeout(tick, 30_000).unref?.();
  const timer = setInterval(tick, 10 * 60 * 1000);
  timer.unref?.();
  return timer;
}
