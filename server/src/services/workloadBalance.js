import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL, ANTHROPIC_THINKING } from "../constants/ai.js";

/**
 * Õpikoormuse tasakaal.
 *
 * Hoiatus ise on puhas JavaScript, mitte AI: "sellel nädalal on 3+ hindelist
 * tööd" on loendamine ja peab olema alati sama vastus. AI lisab ainult
 * soovituse, mida sellega peale hakata — ja see on ettepanek, mille õpetaja
 * kinnitab (RULE A1). Ilma API võtmeta jääb hoiatus alles, kaob ainult soovitus.
 */

const HEAVY_WEEK_THRESHOLD = 3;

/**
 * @param {Array<{ date: string, subject: string, title: string|null }>} exams
 * @returns {{ level: 'ok'|'warning', examCount: number, byDay: Array<{date: string, count: number}>, message: string }}
 */
export function analyseWeekLoad(exams) {
  const byDayMap = new Map();
  for (const e of exams) {
    const day = String(e.date).slice(0, 10);
    byDayMap.set(day, (byDayMap.get(day) || 0) + 1);
  }
  const byDay = [...byDayMap.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const examCount = exams.length;
  const busiest = byDay.reduce((max, d) => (d.count > (max?.count ?? 0) ? d : max), null);

  if (examCount >= HEAVY_WEEK_THRESHOLD) {
    const sameDay =
      busiest && busiest.count > 1
        ? ` Kõige koormatum päev on ${busiest.date} (${busiest.count} tööd).`
        : "";
    return {
      level: "warning",
      examCount,
      byDay,
      message: `Sellel nädalal on ${examCount} hindelist tööd.${sameDay}`,
    };
  }

  return {
    level: "ok",
    examCount,
    byDay,
    message:
      examCount === 0
        ? "Sellel nädalal pole hindelisi töid planeeritud."
        : `Sellel nädalal on ${examCount} hindeline töö — koormus on tasakaalus.`,
  };
}

/**
 * AI soovitus ümberplaneerimiseks. Tagastab `{ text, fallback }` nagu teised
 * AI-teenused, et leht töötaks ka ilma võtmeta.
 */
export async function suggestRebalance({ className, weekRange, exams }, apiKey) {
  if (!apiKey || !String(apiKey).trim()) {
    return {
      text: null,
      fallback:
        "Lisa ANTHROPIC_API_KEY, et näha siin AI soovitust töökoormuse ümberjagamiseks.",
    };
  }
  if (!exams.length) {
    return { text: null, fallback: null };
  }

  const client = new Anthropic({ apiKey: String(apiKey).trim() });
  const payload = JSON.stringify(
    exams.map((e) => ({ kuupaev: e.date, aine: e.subject, teema: e.title || null })),
    null,
    0
  );

  try {
    const msg = await client.messages.create({
      model: ANTHROPIC_MODEL,
      thinking: ANTHROPIC_THINKING,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content:
            "Sa oled õppetöö planeerimise assistent. Analüüsi selle nädala kontrolltööde nimekirja " +
            `klassi ${className} kohta (nädal ${weekRange}) ja hinda, kas õpikoormus on ebaühtlaselt ` +
            "jaotunud. Kui jah, kirjelda 1-2 lausega, millised päevad on ülekoormatud, ja anna üks " +
            "konkreetne ümberplaneerimise soovitus. Kui koormus on tasakaalus, ütle seda lühidalt. " +
            `Vasta eesti keeles. Andmed (JSON): ${payload}`,
        },
      ],
    });

    const block = msg.content?.find((b) => b.type === "text");
    return { text: block ? block.text.trim() : null, fallback: null };
  } catch (err) {
    console.error("[EduAI õpikoormus] AI viga:", err?.status, err?.message);
    return {
      text: null,
      fallback: "AI soovitust ei saanud laadida. Hoiatus arvutatakse ka ilma selleta.",
    };
  }
}
