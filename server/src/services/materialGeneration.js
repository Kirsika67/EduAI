import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL, ANTHROPIC_THINKING } from "../constants/ai.js";
import { extractJsonObject } from "./studentAnalysis.js";

const TYPE_LABELS = {
  worksheet: "tööleht",
  test: "kontrolltöö",
  lesson_plan: "tunnikava",
};

const DIFF_LABELS = {
  light: "kerge",
  medium: "keskmine",
  hard: "raske",
};

/**
 * @param {object} ctx
 * @param {'worksheet'|'test'|'lesson_plan'} ctx.type
 * @param {string} ctx.className
 * @param {string} ctx.subject
 * @param {string} ctx.topicName
 * @param {'light'|'medium'|'hard'} ctx.difficulty
 * @param {number|null} ctx.durationMinutes
 * @param {string|null} ctx.extraNotes
 * @param {string|null} apiKey
 * @returns {Promise<{ title: string, content: string }>}
 */
export async function generateMaterial(ctx, apiKey) {
  if (!apiKey || !String(apiKey).trim()) {
    throw new Error("ANTHROPIC_API_KEY puudub.");
  }

  const client = new Anthropic({ apiKey: String(apiKey).trim() });

  const t = TYPE_LABELS[ctx.type] || ctx.type;
  const d = DIFF_LABELS[ctx.difficulty] || ctx.difficulty;

  let typeInstructions = "";
  if (ctx.type === "worksheet") {
    typeInstructions =
      "Tööleht: harjutusülesanded koos juhistega, võimalusel näidised; struktureeritud jaotiste kaupa; prinditav tekst.";
  } else if (ctx.type === "test") {
    typeInstructions =
      "Kontrolltöö: selged ülesanded, punktid või maht soovituslik; vastuste ruumid või märkimine; prinditav.";
  } else {
    typeInstructions =
      "Tunnikava: eesmärgid, käik (sissejuhatus, põhitegevus, kokkuvõte), ajakava minutitega kui võimalik, õpetaja roll ja vajalikud vahendid; prinditav.";
  }

  const durationHint =
    ctx.durationMinutes && ctx.type === "lesson_plan"
      ? `Eeldatav tunnipikkus umbes ${ctx.durationMinutes} minutit.`
      : "";

  const topicExact = String(ctx.topicName || "").trim();
  if (!topicExact) {
    throw new Error("Teema nimi puudub.");
  }

  const userBlock = JSON.stringify(
    {
      materjaliTyyp: t,
      klass: ctx.className,
      aine: ctx.subject,
      teema: topicExact,
      raskusaste: d,
      kestus: durationHint || null,
      lisajuhendid: ctx.extraNotes || null,
    },
    null,
    0
  );

  const topicRules = `KOHUSTUSLIK TEEMA (ära muuda sõnastust ega asenda teise teemaga):
Õpetaja määras täpse teema: «${topicExact}»

- Kogu materjal (ülesanded, tekstid, näited, küsimused, tunnikava sisu) peab käsitlema AINULT seda teemat — täpselt «${topicExact}».
- Ära asenda teemat teise teose, autori, näite või üldise ainevaldkonnaga (nt kui teemaks on «Nukitsamees», siis ära kirjuta teistest eesti kirjandusteostest või üldisest kirjandusest ilma et keskenduksid «Nukitsamees»-ele).
- Pealkiri ja sisu peavad olema selgelt seotud «${topicExact}»-ga; maini seda nime vajadusel materjalis, et fookus jääks õige.
- Kui teema on konkreetne teos/pealkiri/teemapüstitus, eelda et kõik ülesanded ja selgitused käivad spetsiifiliselt selle kohta, mitte laiema kursuse kohta.`;

  const instruction = `Oled kogenud õpetaja ja õppematerjalide koostaja. Koosta täielik materjal eesti keeles (õpilastele / õpetajale loetav, struktureeritud, konkreetne).

${topicRules}

${typeInstructions}

Vasta AINULT ühe kehtiva JSON objektina (ilma markdown):
{
  "title": "<lühike pealkiri eesti keeles; peab kajastama teemat «${topicExact}»>",
  "content": "<kogu materjal täistekstina, võid kasutada lihtsaid pealkirju reavahetustega ja nummerdatud loendeid>"
}

Kontekst (JSON):
${userBlock}`;

  const msg = await client.messages.create({
    model: ANTHROPIC_MODEL,
    thinking: ANTHROPIC_THINKING,
    max_tokens: 8192,
    messages: [{ role: "user", content: instruction }],
  });

  const block = msg.content?.[0];
  const raw =
    block && block.type === "text" ? block.text.trim() : "";
  if (!raw) throw new Error("AI ei tagastanud teksti.");

  const parsed = extractJsonObject(raw);
  const title = String(parsed.title || "").trim();
  const content = String(parsed.content || "").trim();
  if (!title || !content) {
    throw new Error("AI vastus oli liiga lühike.");
  }

  return { title, content };
}
