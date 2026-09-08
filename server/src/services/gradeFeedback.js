import { askClaudeOrThrow } from "./aiEngine.js";
import { extractJsonObject } from "./studentAnalysis.js";

/**
 * Genereerib iga õpilase jaoks lühikese (1–2 lauset) sõbraliku tagasiside eesti keeles.
 *
 * Siin läheb korraga terve klassi nimekiri — see on ainus koht, kus AI-le
 * jõuaks korraga kõigi laste nimed. Seepärast on pseudonümiseerimine siin
 * kõige olulisem: vastendus käib `studentId` järgi, mis on niikuinii vajalik,
 * ja nimi ise on mudeli jaoks ainult märgis.
 * @returns {Promise<Array<{ studentId: number, text: string }>>}
 */
export async function generateBatchGradeFeedback(ctx, user) {
  const payload = JSON.stringify(
    {
      klass: ctx.className,
      aine: ctx.subject,
      teema: ctx.topicName,
      kuupaev: ctx.date,
      hinded: ctx.entries.map((e) => ({
        opilaseId: e.studentId,
        nimi: e.studentName,
        hinne: e.score,
        markus: e.notes || null,
      })),
    },
    null,
    0
  );

  const instruction = `Oled sõbralik õpetaja. Iga õpilase kohta kirjuta 1–2 lühikest lauset individuaalset tagasisidet eesti keeles (toetav, selge, konkreetne, ilma üleliigse jututa).

Vasta AINULT ühe kehtiva JSON objektina (ilma markdown):
{ "feedbacks": [ { "studentId": <number>, "text": "<tagasiside eesti keeles>" } ] }

Õpilaste ID-d ja nimed peavad täpselt klappima andmetega. Iga objektis "feedbacks" massiivis peab olema täpselt üks kirje iga õpilase kohta.

Andmed:
${payload}`;

  const raw = await askClaudeOrThrow({
    prompt: instruction,
    purpose: "grade_feedback",
    user,
    maxTokens: 2048,
    protectedNames: ctx.entries.map((e) => e.studentName),
  });

  if (!raw) return [];

  let parsed;
  try {
    parsed = extractJsonObject(raw);
  } catch (e) {
    console.error("[EduAI tagasiside] JSON", raw.slice(0, 400));
    throw e;
  }

  const list = parsed.feedbacks;
  if (!Array.isArray(list)) return [];

  return list
    .map((f) => ({
      studentId: Number(f.studentId),
      text: String(f.text || "").trim(),
    }))
    .filter((f) => Number.isInteger(f.studentId) && f.text.length > 0);
}
