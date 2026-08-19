import { askClaudeOrThrow } from "./aiEngine.js";
import { extractJsonObject } from "./studentAnalysis.js";

/**
 * @param {object} ctx
 * @param {string} ctx.className
 * @param {string} ctx.subject
 * @param {string} ctx.weekStartEt — nädala algus (E, nt esmaspäeva kuupäev tekstina)
 * @param {string[]} ctx.topicNames
 * @param {number} ctx.studentCount
 * @param {string|null} ctx.focusNotes
 * @param {object} [user] req.user — AI kasutuslogi jaoks
 * @returns {Promise<{ title: string, planText: string, reminders: Array<{ dayLabel: string, text: string }> }>}
 */
export async function generateWeeklyClassPlan(ctx, user) {
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

  const responseText = await askClaudeOrThrow({


    prompt: instruction,


    purpose: "weekly_plan",


    user,


    maxTokens: 6144,


  });

  const raw = responseText;
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
