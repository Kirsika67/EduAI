import { askClaude } from "./aiEngine.js";

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
 * @param {object} user  req.user — kasutuslogi jaoks
 * @param {string[]} [knownNames]
 *        Nimed, mis selle õpetaja sõnumis esineda võivad (tema klasside
 *        õpilased). Mootor asendab need enne saatmist märgistega ja paneb
 *        vastuses tagasi — nii ei lahku lapse nimi majast ka siis, kui
 *        õpetaja selle ise sõnumisse kirjutas.
 */
export async function assistMessage(text, mode, user, knownNames = []) {
  const config = ASSIST_MODES[mode];
  if (!config) return { text: null, error: "Tundmatu režiim." };

  return askClaude({
    purpose: "message_assist",
    user,
    maxTokens: 1000,
    protectedNames: knownNames,
    fallback: "AI abi ei õnnestunud. Sõnumi saad ikka ise saata.",
    prompt:
      "Sa aitad õpetajal sõnastada sõnumit lapsevanemale või õpilasele. " +
      `${config.instruction} ` +
      "Vasta AINULT ümbersõnastatud tekstiga, ilma selgituste, sissejuhatuse " +
      "ega jutumärkideta. Ära lisa infot, mida algtekstis ei ole — eriti mitte " +
      "väiteid lapse kohta.\n\n" +
      `Algtekst:\n${text}`,
  });
}
