import { askClaudeOrThrow } from "./aiEngine.js";

const TYPE_LABELS = {
  worksheet: "tööleht",
  theory: "teooria (reeglivihik)",
  test: "kontrolltöö",
  lesson_plan: "tunnikava",
};

const DIFF_LABELS = {
  light: "kerge",
  medium: "keskmine",
  hard: "raske",
};

/** Ühine vormindus: valemid LaTeX-is, joonised SVG-s. Klient joonistab need korralikult. */
const FORMAT_RULES = `VORMINDUS (väga oluline, materjal prinditakse ja peab nägema välja nagu päris õpik/tööleht):
- Kirjuta Markdownis: "# Pealkiri", "## Jaotis", nummerdatud ja täpploendid, tabelid vajadusel.
- Kõik matemaatilised avaldised kirjuta LaTeX-is: reasiseselt $...$, eraldi reale $$...$$. ÄRA kirjuta murde kui 1/2 ega astmeid kui x^2 lihttekstina. Murd: $\\frac{1}{2}$, aste: $x^{2}$, juur: $\\sqrt{x}$, korrutamine: $\\cdot$, jagamine: $:$ või $\\div$, kahekordne murd, segaarvud jms ka korrektselt.
- Kirjalik arvutamine (veerg-liitmine, -lahutamine, -korrutamine, jagamine) kirjuta nii nagu seda vihikusse kirjutataks: $$\\begin{array}{r} 358 \\\\ +\\ 276 \\\\ \\hline 634 \\end{array}$$ (numbrid veergudes joondatud).
- Joonised (geomeetria, arvusirge, murdude pildid, tulpdiagrammid, graafikud jne) tee SVG-na koodiplokis märgendiga svg: \`\`\`svg ... \`\`\`. Ainult täielik <svg viewBox="0 0 W H" ...> lihtsate elementidega (line, rect, circle, ellipse, polygon, polyline, path, text, g). Mustvalge joonis valgel taustal, sildid loetavad (font-size 12–14), ei mingeid skripte, linke ega väliseid pilte. Joonis peab olema matemaatiliselt täpne ja sildid õiged.
- Mitte-matemaatilistes ainetes jäta valemid ja joonised ära, kui neid pole vaja.
- Uue lehekülje koht (nt õpetaja vastuste ette): kirjuta eraldi reale täpselt [[LEHEKULG]].
- Pealkiri on esimene rida kujul "# Pealkiri".`;

/**
 * @param {object} ctx
 * @param {'worksheet'|'theory'|'test'|'lesson_plan'} ctx.type
 * @param {string} ctx.className
 * @param {string} ctx.subject
 * @param {string} ctx.topicName
 * @param {'light'|'medium'|'hard'} ctx.difficulty
 * @param {number|null} ctx.durationMinutes
 * @param {string|null} ctx.extraNotes
 * @param {1|2} [ctx.variants] kontrolltöö variantide arv
 * @param {boolean} [ctx.includeAnswers] lisa õpetaja vastused eraldi lehele
 * @param {object} [user] req.user — AI kasutuslogi jaoks
 * @returns {Promise<{ title: string, content: string }>}
 */
export async function generateMaterial(ctx, user) {
  const t = TYPE_LABELS[ctx.type] || ctx.type;
  const d = DIFF_LABELS[ctx.difficulty] || ctx.difficulty;

  let typeInstructions = "";
  if (ctx.type === "theory") {
    typeInstructions = `TEOORIA (REEGLIVIHIK): selgita teema õpilasele täielikult selgeks, nagu hea õpik või õpilase reeglivihik.
- Alusta lühikese sissejuhatusega: milleks seda teemat vaja on.
- Selgita mõisted ja reeglid ning IGA tehte või reegli juures ka MIKS see nii töötab (põhjendus, mitte ainult eeskiri).
- Kõik olulised valemid ja reeglid pane esile eraldi kastidena (Markdowni tsitaatplokk, mis algab sõnadega "Pea meeles:").
- Anna 3–5 samm-sammult läbitöötatud näidet (üksikasjalikult, igat sammu selgitades), lihtsamast keerulisemani.
- Tee joonised (SVG) kõikjal, kus need aitavad mõista.
- Lõpus: "Kokkuvõte" meelespeana (3–7 punkti) ja 2–3 lühikest harjutust enesekontrolliks vastustega.
- Ülesannete hulk on väike — põhirõhk on selgitusel.`;
  } else if (ctx.type === "worksheet") {
    typeInstructions = `TÖÖLEHT: see on harjutuste leht, mitte teooriatekst.
- Väga vähe seletust: ülaosas lühike meelespea kast (1–3 valemit või reeglit, ainult kui vaja), edasi põhiliselt ülesanded.
- Ülesanded jaotatud tasemeteks: A (lihtsad, kordamine), B (keskmised), C (raskemad, mõtlemisülesanded). Ca 12–18 ülesannet kokku, korduvate tehetega ja vahelduvate arvudega.
- Jäta iga ülesande järel ruumi lahendamiseks (kirjuta "Lahendus:" ja tühjad read või joonistatud ruudustik tabelina).
- Sobivas kohas 1–2 joonisülesannet (SVG), kus õpilane täidab või leiab midagi.
- Nimi/kuupäev rida lehe ülaosas.${ctx.includeAnswers ? "\n- Lõppu, uuele lehele ([[LEHEKULG]]), pane pealkirjaga 'Õpetajale: vastused' kõigi ülesannete vastused." : ""}`;
  } else if (ctx.type === "test") {
    const variants = ctx.variants === 2 ? 2 : 1;
    typeInstructions = `KONTROLLTÖÖ: ainult ülesanded.
- ÜHTEGI selgitust, teooriat, valemit ega vihjet ülesannete juures (välja arvatud, kui õpetaja lisajuhendites seda otse palub).
- ${variants === 2 ? "Koosta KAKS võrdse raskusega varianti (Variant A ja Variant B): samad oskused ja sama ülesannete struktuur, aga erinevad arvud/andmed. Iga variant algab uuelt lehelt ([[LEHEKULG]]) ja on eraldi trükitav." : "Koosta üks variant."}
- Igas variandis ülesanded järjestatud lihtsamatest raskemateni (märgi tasemed näiteks sümbolitega ★, ★★, ★★★ või "Ülesanded 1–4 (lihtsamad)", "5–7 (keskmised)", "8–9 (raskemad)").
- Iga ülesande juures punktid sulgudes, nt (2 p). Lehe ülaosas: Nimi, Klass, Kuupäev, kokku punktid ja hindamisskaala protsentides (nt 90–100% = 5).
- Jäta ruumi lahendamiseks ("Lahendus:" ja tühjad read).
- Sobivas kohas sobiv joonisülesanne (SVG), kui aines on mõtet.${ctx.includeAnswers ? "\n- Lõppu, uuele lehele ([[LEHEKULG]]), lisa 'Õpetajale: vastused ja hindamisjuhend' (vastused, punktijaotus, tüüpvead)." : ""}`;
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

- Kogu materjal peab käsitlema AINULT seda teemat — täpselt «${topicExact}».
- Ära asenda teemat teise teose, autori, näite või üldise ainevaldkonnaga.
- Pealkiri ja sisu peavad olema selgelt seotud «${topicExact}»-ga.`;

  const instruction = `Oled kogenud õpetaja ja õppematerjalide koostaja. Koosta täielik materjal eesti keeles, valmis printimiseks.

${topicRules}

${typeInstructions}

${FORMAT_RULES}

Vasta AINULT materjali endaga Markdownis (ilma sissejuhatava jututa, ilma JSON-ita, ilma kogu vastust ümbritseva koodiplokita).

Kontekst (JSON):
${userBlock}`;

  const raw = await askClaudeOrThrow({
    prompt: instruction,
    purpose: "material",
    user,
    maxTokens: 12000,
    timeoutMs: 180_000,
  });
  if (!raw) throw new Error("AI ei tagastanud teksti.");

  let text = raw.trim();
  /** Kui mudel pani terve vastuse koodiplokki, võta see lahti. */
  const wrapped = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/);
  if (wrapped) text = wrapped[1].trim();

  const heading = text.match(/^#\s+(.+)$/m);
  const title = (heading ? heading[1] : `${t[0].toUpperCase()}${t.slice(1)}: ${topicExact}`).replace(/[*_`]/g, "").trim();
  if (text.length < 200) throw new Error("AI vastus oli liiga lühike.");

  return { title, content: text };
}
