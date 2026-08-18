import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL, ANTHROPIC_THINKING } from "../constants/ai.js";
import { extractJsonObject } from "./studentAnalysis.js";

/**
 * @param {object} ctx
 * @param {string} ctx.className
 * @param {string} ctx.subject
 * @param {string} ctx.weekStartEt — nädala algus (E, nt esmaspäeva kuupäev tekstina)
 * @param {string[]} ctx.topicNames
 * @param {number} ctx.studentCount
 * @param {string|null} ctx.focusNotes
 * @param {string|null} apiKey
 * @returns {Promise<{ title: string, planText: string, reminders: Array<{ dayLabel: string, text: string }> }>}
 */
export async function generateWeeklyClassPlan(ctx, apiKey) {
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error("ANTHROPIC_API_KEY puudub.");
  }

  const client = new Anthropic({ apiKey: String(apiKey).trim() });

  const payload = JSON.stringify(
    {
      klass: ctx.className,
      aine: ctx.subject,
      nadalaAlgus: ctx.weekStartEt,
      teemad: ctx.topicNames,
      opilasi: ctx.studentCount,
      lisasoovid: ctx.focusNotes || null,
    },
    null,
    0
  );

  const instruction = `Oled kogenud klassijuhatav õpetaja. Koosta ÜHE NÄDALA tunnitöö plaan eesti keeles (5 koolipäeva: E–R), konkreetne ja rakendatav.

Lisa ka lühikesed meeldetuletused õpetajale (mitte õpilastele push-teated): iga punkt on üks rida, mis ütleb mida jälgida või meeles pidada.

Vasta AINULT ühe kehtiva JSON objektina (ilma markdown):
{
  "title": "<lühike pealkiri eesti keeles>",
  "planText": "<täistekst: struktureeritud päevade kaupa, võid kasutada pealkirju ja nummerdatud loendeid>",
  "reminders": [
    { "dayLabel": "<nt Esmaspäev või kuupäev lühidalt>", "text": "<meeldetuletuse tekst>" }
  ]
}

Meeldetuletusi peaks olema 4–8, kattuvad nädala jooksul. Päevasildid peavad olema eesti keeles.

Kontekst:
${payload}`;

  const msg = await client.messages.create({
    model: ANTHROPIC_MODEL,
    thinking: ANTHROPIC_THINKING,
    max_tokens: 6144,
    messages: [{ role: "user", content: instruction }],
  });

  const block = msg.content?.[0];
  const raw =
    block && block.type === "text" ? block.text.trim() : "";
  if (!raw) throw new Error("AI ei tagastanud teksti.");

  const parsed = extractJsonObject(raw);
  const title = String(parsed.title || "").trim();
  const planText = String(parsed.planText || "").trim();
  let reminders = parsed.reminders;
  if (!Array.isArray(reminders)) reminders = [];

  reminders = reminders
    .map((r) => ({
      dayLabel: String(r.dayLabel || "").trim(),
      text: String(r.text || "").trim(),
    }))
    .filter((r) => r.dayLabel && r.text);

  if (!title || !planText) {
    throw new Error("AI vastus oli liiga lühike.");
  }

  return { title, planText, reminders };
}
