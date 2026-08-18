import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL, ANTHROPIC_THINKING } from "../constants/ai.js";

/**
 * Eemaldab võimaliku ```json ... ``` ümbrise.
 * @param {string} raw
 */
export function extractJsonObject(raw) {
  const s = String(raw).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const inner = fence ? fence[1].trim() : s;
  const start = inner.indexOf("{");
  const end = inner.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI vastuses pole kehtivat JSON-objekti.");
  }
  return JSON.parse(inner.slice(start, end + 1));
}

/**
 * @param {object} input
 * @param {string|null} apiKey
 * @returns {Promise<{
 *   mainProblem: string,
 *   hypothesis: string,
 *   plan4Weeks: string,
 *   suggestedTasks: string,
 *   parentEmail: string,
 *   parentSms: string
 * }>}
 */
export async function runStudentAiAnalysis(input, apiKey) {
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error("ANTHROPIC_API_KEY puudub.");
  }

  const client = new Anthropic({ apiKey: String(apiKey).trim() });

  const payload = JSON.stringify(
    {
      opilane: input.studentName,
      klass: input.className,
      aine: input.subject,
      hinded: input.grades,
      klassiKeskmisedTeemad: input.classTopicAverages,
    },
    null,
    0
  );

  const instruction = `Oled kogenud klassiõpetaja ja õppenõustaja. Analüüsi õpilase olukorda ja vasta AINULT ühe kehtiva JSON objektina (ilma markdown, ilma selgitava teksti enne või pärast).

Kohustuslikud võtmed (stringid, eesti keeles):
- "mainProblem": lühike lõik — mis on põhiprobleem õppimises?
- "hypothesis": lühike lõik — miks see võis juhtuda (AI hüpotees)?
- "plan4Weeks": 4 nädala plaan sammhaaval (nummerdatud nädalad 1–4, konkreetsed sammud)?
- "suggestedTasks": soovituslikud harjutused/ülesanded (täpne, rakendatav tekst)?
- "parentEmail": sõbralik ametlik kiri lapsevanemale (tervitus, olukord, koostööpalve, allkiri stiilis "Lugupidamisega")?
- "parentSms": väga lühike SMS lapsevanemale (alla 320 tähemärki)?

Andmed (JSON):
${payload}`;

  let text = "";
  try {
    const msg = await client.messages.create({
      model: ANTHROPIC_MODEL,
      thinking: ANTHROPIC_THINKING,
      max_tokens: 4096,
      messages: [{ role: "user", content: instruction }],
    });
    const block = msg.content?.[0];
    text = block && block.type === "text" ? block.text.trim() : "";
  } catch (err) {
    console.error("[EduAI õpilase analüüs] Anthropic", {
      model: ANTHROPIC_MODEL,
      message: err?.message,
      status: err?.status,
    });
    throw err;
  }

  if (!text) {
    throw new Error("AI ei tagastanud teksti.");
  }

  let parsed;
  try {
    parsed = extractJsonObject(text);
  } catch (e) {
    console.error("[EduAI õpilase analüüs] JSON parse", text.slice(0, 500));
    throw new Error("AI vastust ei saanud töödelda. Proovi uuesti.");
  }

  const out = {
    mainProblem: String(parsed.mainProblem || "").trim(),
    hypothesis: String(parsed.hypothesis || "").trim(),
    plan4Weeks: String(parsed.plan4Weeks || "").trim(),
    suggestedTasks: String(parsed.suggestedTasks || "").trim(),
    parentEmail: String(parsed.parentEmail || "").trim(),
    parentSms: String(parsed.parentSms || "").trim().slice(0, 320),
  };

  if (!out.mainProblem && !out.plan4Weeks) {
    throw new Error("AI vastus oli tühi.");
  }

  return out;
}
