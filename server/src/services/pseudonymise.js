/**
 * Pseudonümiseerimine — päris nimed ei lahku majast.
 *
 * Enne iga Anthropicu kutset asendatakse õpilaste (ja lapsevanemate) nimed
 * märgistega `[Õ1]`, `[Õ2]`, … Vastuses tehakse asendus tagasi. Anthropic
 * näeb hindeid, kohalolekut ja teemasid — aga mitte seda, kelle omad need on.
 *
 * MIKS MÄRGIS, MITTE VÄLJAMÕELDUD NIMI:
 * Eesti keel käänab nimesid ("Mari" → "Marile", "Marit"). Väljamõeldud nime
 * käänaks mudel samamoodi ja tagasiasendus muutuks ebakindlaks. Nurksulgudes
 * märgis ei käändu — mudelile öeldakse, et käändelõpp tuleb sidekriipsuga
 * ("[Õ1]-le"), ja tagasiasendusel liidetakse see kokku ("Marile").
 *
 * ÜLEKATTE PÕHIMÕTE: kahtluse korral peida rohkem, mitte vähem. Nime järel
 * lubatakse kuni 4 tähte käändelõppu — see võib katta ka mõne muu sarnase
 * sõna, aga pigem see kui lekkinud nimi.
 *
 * Väljalülitamine: `AI_PSEUDONYMISE=off` keskkonnamuutuja. Vaikimisi SEES.
 */

/** Nimi peab olema vähemalt nii pikk, et teda üldse peita — "Jan" jah, "Jo" ei. */
const MIN_NAME_LENGTH = 3;

/** Mitu tähte võib nime järel olla käändelõpp ("Marile" = "Mari" + "le"). */
const MAX_CASE_SUFFIX = 4;

export function pseudonymisationEnabled() {
  return String(process.env.AI_PSEUDONYMISE || "on").toLowerCase() !== "off";
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Juhis, mis lisatakse promptile, kui märgiseid kasutati. Ilma selleta võib
 * mudel märgise ära "parandada" või välja jätta.
 */
export const SHIELD_INSTRUCTION =
  "NIMEDE MÄRGISED: inimeste nimed on asendatud märgistega kujul [Õ1], [Õ2]. " +
  "Kasuta neid täpselt samal kujul, ära muuda, tõlgi ega jäta neid välja. " +
  "Kui vajad käänet, kirjuta märgis ja käändelõpp sidekriipsuga: [Õ1]-le, [Õ1]-t.";

/**
 * Loob nimekilbi ühe AI-kutse jaoks.
 *
 * @param {Array<string|null|undefined>} names Päris nimed, mis võivad tekstis esineda
 * @returns {{
 *   active: boolean,
 *   count: number,
 *   mask: (text: string) => string,
 *   unmask: (text: string) => string
 * }}
 */
export function createNameShield(names = []) {
  const inactive = {
    active: false,
    count: 0,
    mask: (t) => t,
    unmask: (t) => t,
  };

  if (!pseudonymisationEnabled()) return inactive;

  /** Unikaalsed, puhastatud nimed. */
  const unique = [];
  const seen = new Set();
  for (const raw of names) {
    const name = String(raw ?? "").trim().replace(/\s+/g, " ");
    if (name.length < MIN_NAME_LENGTH) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(name);
  }

  if (!unique.length) return inactive;

  /** token → päris nimi */
  const byToken = new Map();
  /** alias (nimi või selle osa) → token */
  const aliases = [];

  unique.forEach((name, i) => {
    const token = `[Õ${i + 1}]`;
    byToken.set(token, name);

    aliases.push({ alias: name, token });

    /**
     * Eraldi ka ees- ja perekonnanimi: tekstis esineb sageli ainult "Mari",
     * kuigi andmetes on "Mari Tamm". Tagasi asendame terve nime — ametlikus
     * kirjas lapsevanemale on see pigem õige kui vale.
     */
    for (const part of name.split(" ")) {
      if (part.length >= MIN_NAME_LENGTH) aliases.push({ alias: part, token });
    }
  });

  /** Pikimad enne: "Mari Tamm" peab minema enne "Mari", "Marina" enne "Mari". */
  aliases.sort((a, b) => b.alias.length - a.alias.length);

  /**
   * Sõnapiir ilma `\b`-ta: `\b` on ASCII-põhine ja katkeb täpitähtedel
   * (õ, ä, ö, ü). `\p{L}` katab kõik tähed.
   */
  const patterns = aliases.map(({ alias, token }) => ({
    re: new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegex(alias)}\\p{L}{0,${MAX_CASE_SUFFIX}}(?![\\p{L}\\p{N}])`,
      "giu"
    ),
    token,
  }));

  function mask(text) {
    let out = String(text ?? "");
    for (const { re, token } of patterns) {
      out = out.replace(re, token);
    }
    return out;
  }

  function unmask(text) {
    let out = String(text ?? "");

    /**
     * Esmalt käändega kuju: "[Õ1]-le" → "Marile".
     *
     * Käändelõpp liidetakse EESNIMELE, mitte tervele nimele: "Mari Tammle"
     * ei ole eesti keel. Nominatiivis (allpool) läheb terve nimi — ametlikus
     * kirjas lapsevanemale on "Mari Tamm" just õige.
     */
    out = out.replace(/\[Õ(\d+)\]-(\p{L}+)/gu, (whole, n, suffix) => {
      const real = byToken.get(`[Õ${n}]`);
      if (!real) return whole;
      return real.split(" ")[0] + suffix;
    });

    /** Seejärel paljas märgis. */
    out = out.replace(/\[Õ(\d+)\]/gu, (whole, n) => byToken.get(`[Õ${n}]`) ?? whole);

    return out;
  }

  return { active: true, count: unique.length, mask, unmask };
}
