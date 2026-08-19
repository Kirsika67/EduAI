import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL, ANTHROPIC_THINKING } from "../constants/ai.js";

/**
 * AI abi sõnumi kirjutamisel.
 *
 * RULE A1: see EI SAADA kunagi midagi. Tagastab ainult teksti, mille õpetaja
 * näeb, saab muuta ja alles siis ise saatmise nupule vajutab. Automaatset
 * saatmist siin ei ole ega tohi tulla — lapsevanemale läheb see, mille all on
 * inimese nimi.
 */

export const ASSIST_MODES = {
  formal: {
    label: "Ametlikum",
    instruction:
      "Kirjuta see sõnum ametlikumas, viisakamas toonis ümber. Sisu peab jääma samaks.",
  },
  friendly: {
    label: "Sõbralikum",
    instruction:
      "Kirjuta see sõnum soojemas ja toetavamas toonis ümber, jäädes samas professionaalseks. Sisu peab jääma samaks.",
  },
  shorter: {
    label: "Lühem",
    instruction:
      "Lühenda seda sõnumit, säilitades kogu olulise info. Eemalda kordused ja täitesõnad.",
  },
  translate_en: {
    label: "Inglise keelde",
    instruction: "Tõlgi see sõnum inglise keelde, säilitades tooni ja viisakusvormid.",
  },
  translate_ru: {
    label: "Vene keelde",
    instruction: "Tõlgi see sõnum vene keelde, säilitades tooni ja viisakusvormid.",
  },
};

/**
 * @param {string} text
 * @param {keyof typeof ASSIST_MODES} mode
 * @param {string|undefined} apiKey
 */
export async function assistMessage(text, mode, apiKey) {
  const config = ASSIST_MODES[mode];
  if (!config) return { text: null, error: "Tundmatu režiim." };
  if (!apiKey || !String(apiKey).trim()) {
    return {
      text: null,
      fallback: "Lisa ANTHROPIC_API_KEY, et AI saaks sõnumi sõnastamisel aidata.",
    };
  }

  const client = new Anthropic({ apiKey: String(apiKey).trim() });
  try {
    const msg = await client.messages.create({
      model: ANTHROPIC_MODEL,
      thinking: ANTHROPIC_THINKING,
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content:
            "Sa aitad õpetajal sõnastada sõnumit lapsevanemale või õpilasele. " +
            `${config.instruction} ` +
            "Vasta AINULT ümbersõnastatud tekstiga, ilma selgituste, sissejuhatuse " +
            "ega jutumärkideta. Ära lisa infot, mida algtekstis ei ole — eriti mitte " +
            "väiteid lapse kohta.\n\n" +
            `Algtekst:\n${text}`,
        },
      ],
    });
    const block = msg.content?.find((b) => b.type === "text");
    return { text: block ? block.text.trim() : null };
  } catch (err) {
    console.error("[EduAI sõnumiabi] AI viga:", err?.status, err?.message);
    return { text: null, fallback: "AI abi ei õnnestunud. Sõnumi saad ikka ise saata." };
  }
}
