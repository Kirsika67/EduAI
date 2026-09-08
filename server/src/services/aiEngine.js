import Anthropic from "@anthropic-ai/sdk";
import db from "../db.js";
import { ANTHROPIC_MODEL, ANTHROPIC_THINKING } from "../constants/ai.js";
import { createNameShield, SHIELD_INSTRUCTION } from "./pseudonymise.js";

/**
 * Läbiv AI-mootor — üks koht, kust kõik Claude'i kutsed läbi käivad.
 *
 * Miks üks koht:
 *  - Mudeli ID, timeout ja veakäsitlus on ühes failis, mitte laiali kaheksas
 *  - Iga kutse logitakse `ai_usage` tabelisse (AI-määruse logimisnõue)
 *  - Ilma API võtmeta käitub kogu rakendus ühtemoodi: `fallback` tekst, mitte viga
 *  - Pseudonümiseerimine on ühes kohas: ükski teenus ei saa seda kogemata vahele jätta
 *
 * Mida see EI tee: ei salvesta prompti ega vastust. Logi ütleb, ET kutse tehti
 * ja mis otstarbel — mitte mida lapse kohta kirjutati.
 */

const TIMEOUT_MS = 45_000;

/** Iga AI-funktsioon registreerib end siin, et kasutuslogi oleks loetav. */
export const AI_PURPOSES = {
  class_overview: "Klassi ülevaade",
  student_analysis: "Õpilase analüüs",
  learning_plan: "Õpiplaan",
  material: "Õppematerjal",
  weekly_plan: "Nädalaplaan",
  parent_letter: "Kiri lapsevanemale",
  workload_balance: "Õpikoormuse soovitus",
  message_assist: "Sõnumi sõnastus",
  mentor_goal: "Mentorluse vahesammud",
  school_summary: "Kooli koondhinnang",
  grade_feedback: "Hinde tagasiside",
};

function logUsage({ user, purpose, ok, errorKind, inputChars, outputChars, durationMs }) {
  try {
    db.prepare(
      `INSERT INTO ai_usage
         (school_id, account_id, purpose, model, ok, error_kind, input_chars, output_chars, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      user?.schoolId ?? null,
      user?.id ?? null,
      purpose,
      ANTHROPIC_MODEL,
      ok ? 1 : 0,
      errorKind || null,
      inputChars ?? null,
      outputChars ?? null,
      durationMs ?? null
    );
  } catch (err) {
    /** Logimise viga ei tohi AI-funktsiooni maha võtta. */
    console.error("[EduAI ai_usage] logimine ebaõnnestus:", err.message);
  }
}

export function hasApiKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY && String(process.env.ANTHROPIC_API_KEY).trim());
}

/**
 * @param {object} opts
 * @param {string} opts.prompt        Kasutaja sõnum mudelile
 * @param {keyof AI_PURPOSES} opts.purpose
 * @param {object} [opts.user]        req.user — logimiseks (kool, konto)
 * @param {number} [opts.maxTokens]
 * @param {string} [opts.fallback]    Tekst, mis näidatakse ilma võtmeta
 * @param {string[]} [opts.protectedNames]
 *        Päris nimed, mis promptis esineda võivad. Need asendatakse enne
 *        saatmist märgistega ja pannakse vastuses tagasi. Anna siia KÕIK
 *        nimed, mis andmetes olla võivad — üleliigne nimi ei tee kahju,
 *        puuduolev nimi lekib.
 * @returns {Promise<{ text: string|null, fallback: string|null }>}
 */
export async function askClaude({
  prompt,
  purpose,
  user,
  maxTokens = 800,
  protectedNames = [],
  fallback = "AI vastust ei saanud laadida. Ülejäänud info on olemas ka ilma selleta.",
}) {
  if (!hasApiKey()) {
    logUsage({ user, purpose, ok: false, errorKind: "no_api_key", inputChars: prompt.length });
    return {
      text: null,
      fallback: "Lisa ANTHROPIC_API_KEY, et AI-funktsioonid tööle hakkaksid.",
    };
  }

  /**
   * Nimekilp. `mask` käib ainult prompti sisu peale — juhis ise lisatakse
   * pärast maskimist, et mudel selle terviklikult kätte saaks.
   */
  const shield = createNameShield(protectedNames);
  const outgoingPrompt = shield.active
    ? `${SHIELD_INSTRUCTION}\n\n${shield.mask(prompt)}`
    : prompt;

  const started = Date.now();
  const client = new Anthropic({
    apiKey: String(process.env.ANTHROPIC_API_KEY).trim(),
    timeout: TIMEOUT_MS,
  });

  try {
    const msg = await client.messages.create({
      model: ANTHROPIC_MODEL,
      thinking: ANTHROPIC_THINKING,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: outgoingPrompt }],
    });

    const block = msg.content?.find((b) => b.type === "text");
    const masked = block ? block.text.trim() : null;
    const text = masked === null ? null : shield.unmask(masked);

    logUsage({
      user,
      purpose,
      ok: true,
      inputChars: outgoingPrompt.length,
      outputChars: text?.length ?? 0,
      durationMs: Date.now() - started,
    });

    return { text, fallback: text ? null : fallback };
  } catch (err) {
    const errorKind = err?.status ? `http_${err.status}` : err?.name || "unknown";
    console.error(`[EduAI AI:${purpose}]`, errorKind, err?.message);
    logUsage({
      user,
      purpose,
      ok: false,
      errorKind,
      inputChars: outgoingPrompt.length,
      durationMs: Date.now() - started,
    });
    return { text: null, fallback };
  }
}

/**
 * Sama, mis `askClaude`, aga viskab vea, kui teksti ei tulnud.
 *
 * Olemas sellepärast, et genereerimisteenused (materjal, nädalaplaan,
 * õpilase analüüs) käitusid nii juba enne mootorit: viga lendab marsruuti,
 * mis kuvab oma varuvariandi. Kui muudaks selle vaikselt `null`-iks,
 * salvestaks marsruut tühja materjali.
 */
export async function askClaudeOrThrow({ prompt, purpose, user, maxTokens, protectedNames }) {
  const result = await askClaude({ prompt, purpose, user, maxTokens, protectedNames });
  if (!result.text) {
    throw new Error(result.fallback || "AI vastust ei saadud.");
  }
  return result.text;
}

/** Kasutusstatistika juhtkonnale. */
export function usageSummary(db_, schoolId, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  const byPurpose = db_
    .prepare(
      `SELECT purpose,
              COUNT(*) AS calls,
              SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) AS ok_calls,
              ROUND(AVG(duration_ms)) AS avg_ms
       FROM ai_usage
       WHERE school_id IS ? AND created_at >= ?
       GROUP BY purpose
       ORDER BY calls DESC`
    )
    .all(schoolId, since);

  const totals = db_
    .prepare(
      `SELECT COUNT(*) AS calls,
              SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) AS ok_calls,
              COUNT(DISTINCT account_id) AS users
       FROM ai_usage
       WHERE school_id IS ? AND created_at >= ?`
    )
    .get(schoolId, since);

  return {
    days,
    totals: {
      calls: totals?.calls ?? 0,
      okCalls: totals?.ok_calls ?? 0,
      users: totals?.users ?? 0,
    },
    byPurpose: byPurpose.map((r) => ({
      purpose: r.purpose,
      label: AI_PURPOSES[r.purpose] || r.purpose,
      calls: r.calls,
      okCalls: r.ok_calls,
      avgMs: r.avg_ms,
    })),
  };
}
