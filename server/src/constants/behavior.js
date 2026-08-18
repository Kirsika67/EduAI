/**
 * Käitumismärkuste kategooriad. Juhend soovitas "kooli enda väärtused" —
 * need on vaikimisi neli, mis katavad enamiku koolide väärtuskasvatust.
 * Vabatekst on lubatud, seega kool ei ole nendega lukus.
 */
export const BEHAVIOR_CATEGORIES = [
  "Koostöö",
  "Vastutus",
  "Iseseisvus",
  "Abivalmidus",
];

/**
 * `kind` on olemasolev veerg, millest sõltub ABC-riskimudel — seda ei muudeta.
 * Juhendi `sentiment` tuletatakse siit, uut veergu ei lisata (vt K2).
 */
export const BEHAVIOR_KINDS = ["positive", "concern", "incident"];

export const KIND_LABELS = {
  positive: "Positiivne",
  concern: "Muremärkus",
  incident: "Juhtum",
};

export function sentimentOf(kind) {
  return kind === "positive" ? "positive" : "negative";
}
