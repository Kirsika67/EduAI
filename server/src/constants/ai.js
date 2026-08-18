/** Anthropic mudel (Messages API). Ainus koht, kus mudelit määratakse. */
export const ANTHROPIC_MODEL = "claude-sonnet-5";

/**
 * Sonnet 5 puhul on adaptiivne mõtlemine VAIKIMISI SEES ja `max_tokens` katab
 * mõtlemise + vastuse koos. Vanad kutsed on kirjutatud eeldusel, et kogu
 * `max_tokens` läheb vastusesse — nt AI ülevaade küsib 400 tokenit 3-4 lause
 * kohta, mis läheks mõtlemise peale ära ja vastus jääks tühjaks.
 *
 * Seepärast on mõtlemine siin teadlikult välja lülitatud: see hoiab käitumise
 * täpselt samasugusena nagu enne ja kulu ennustatavana. Kui tahad kvaliteeti
 * tõsta, lülita mõtlemine sisse ühes teenuses korraga ja tõsta selle
 * `max_tokens` (nt studentAnalysis 4096 → 8192) — mitte kõigis korraga.
 */
export const ANTHROPIC_THINKING = { type: "disabled" };

/**
 * Ühine päringu põhi. Kasuta: `{ ...anthropicRequestBase(), messages: [...] }`
 * ja lisa oma `max_tokens`.
 */
export function anthropicRequestBase() {
  return {
    model: ANTHROPIC_MODEL,
    thinking: ANTHROPIC_THINKING,
  };
}
