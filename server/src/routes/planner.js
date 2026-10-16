import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireStaff } from "../middleware/auth.js";
import { visibleClassIds } from "../services/access.js";
import { chatClaude } from "../services/aiEngine.js";

const router = Router();
router.use(requireAuth, requireStaff);

const MAX_MESSAGES = 30;
const MAX_TEXT = 8000;
const MAX_IMAGES_TOTAL = 6;
const MAX_IMAGE_B64 = 3_000_000;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const iso = (d) => d.toISOString().slice(0, 10);
const WEEKDAYS = ["", "esmaspäev", "teisipäev", "kolmapäev", "neljapäev", "reede", "laupäev", "pühapäev"];

function buildContext(classId) {
  const cls = db.prepare(`SELECT id, name, subject FROM classes WHERE id = ?`).get(classId);
  const lessons = db
    .prepare(
      `SELECT subject, day_of_week, lesson_number, start_time FROM timetable_entries
       WHERE class_id = ? ORDER BY day_of_week, lesson_number`
    )
    .all(classId)
    .map((l) => `${WEEKDAYS[l.day_of_week]} ${l.lesson_number}. tund ${l.subject}${l.start_time ? ` (${l.start_time})` : ""}`);
  const today = new Date();
  const exams = db
    .prepare(`SELECT subject, title, date FROM exams WHERE class_id = ? AND date >= ? AND date <= ? ORDER BY date`)
    .all(classId, iso(today), iso(new Date(today.getTime() + 84 * 86400000)))
    .map((e) => `${e.date}: ${e.title || e.subject}`);
  const assignments = db
    .prepare(`SELECT subject, title, due_date, kind FROM assignments WHERE class_id = ? AND due_date >= ? AND due_date <= ? ORDER BY due_date`)
    .all(classId, iso(today), iso(new Date(today.getTime() + 42 * 86400000)))
    .map((a) => `${a.due_date}: ${a.kind === "task" ? "ülesanne" : "kodutöö"} — ${a.title}`);
  return {
    tana: `${iso(today)} (${WEEKDAYS[((today.getDay() + 6) % 7) + 1]})`,
    klass: `${cls.name} ${cls.subject}`,
    nadalaTunniplaan: lessons,
    tulevadKontrolltood: exams,
    olemasolevadKodutood: assignments,
  };
}

function systemPrompt(ctx) {
  return `Sa oled kogenud õpetaja planeerimisabiline. Õpetaja annab sulle kontrolltöö tulemused (pildina või tekstina) ja/või eesmärgid ning sa aitad koostada tunnikava, kodutööde ja kordamise plaani järelejäänud aja jaoks. Vasta alati eesti keeles.

Kuidas töötad:
1. Aja vestlust, ära kirjuta kohe plaani. Esita korraga 1–3 lühikest täpsustavat küsimust. Selgita vajadusel välja: millise teema/kontrolltöö tulemustest on jutt ja mis läks halvasti; mis on eesmärk (nt keskmine tulemus, kindlad oskused); kuupäev, milleks tulemus peab saavutatud olema (järgmine kontrolltöö, veerandi lõpp); mitu tundi nädalas on ja kas tunniplaan vastab tõele; kui palju kodutööd õpilased jõuavad; klassi tase ja eripärad; ressursid ja eelistatud töövormid.
2. Kui sul on piisavalt infot, kui õpetaja on vastanud sinu küsimustele või ütleb "planeeri", koosta plaan KOHE — ära küsi enam juurde. Tee mõistlikud eeldused ja nimeta need plaani alguses ühe lausega. Kui õpetaja pole nimetanud kuupäeva, eelda lähim tulevane kontrolltöö tunniplaanist/kalendrist või pakkuma 3 nädalat.
   Märkus: tunniplaanis on klassi KÕIK ained. Planeeri õpetaja nimetatud aine tundide jaoks; kui see aine tunniplaanis nimeliselt puudub või ained erinevad, ära takerdu sellesse — eelda, et õpetaja tunnid on tunniplaanis tema aine nime all, ja ütle eelduse välja. Kasuta ainult allpool antud tegelikke tunnipäevi. Ära paku kodutöö tähtaega päevale, millal selles klassis tundi pole.
3. Plaani vorm (markdown): "## Kokkuvõte" (2–3 lauset), "## Tunnikava" (iga tund eraldi: kuupäev, teema, tegevused, aeg minutites), "## Kodutööd" (kuupäev, mida teha, umbkaudne aeg), "## Kordamine ja kontrolltöö".
4. Plaani lõppu lisa täpselt üks koodiplokk märgendiga plan, milles on JSON: {"homework":[{"date":"YYYY-MM-DD","title":"lühike pealkiri","description":"mida teha"}],"exams":[{"date":"YYYY-MM-DD","title":"pealkiri"}]}. Kodutöö tähtaeg ("date") on alati selle järgmise tunni kuupäev, millal kodutöö tuleb kaasa tuua — see peab olema päev, millal klassil tund on (tunniplaani nädalapäev), mitte nädalavahetus ega muu päev. Kuupäevad peavad olema tulevikus. Kui kontrolltööd ei paku, jäta exams tühjaks.
5. Pildilt loe tulemused ettevaatlikult; kui midagi pole loetav, küsi. Ära kunagi korda õpilaste nimesid, kui need pildil või tekstis on — kasuta "õpilane A", "õpilane B". Ära mõtle andmeid juurde.
6. Ole konkreetne ja realistlik. Õpetaja otsustab, sina teed ettepanekuid.

Klassi andmed (JSON):
${JSON.stringify(ctx)}`;
}

router.post("/chat", async (req, res) => {
  const classId = Number(req.body?.classId);
  if (!Number.isInteger(classId) || !visibleClassIds(req.user).includes(classId)) {
    return res.status(404).json({ error: "Vali klass." });
  }
  const raw = Array.isArray(req.body?.messages) ? req.body.messages.slice(-MAX_MESSAGES) : [];
  let imageCount = 0;
  const messages = [];
  for (const m of raw) {
    const role = m?.role === "assistant" ? "assistant" : "user";
    const text = String(m?.text || "").slice(0, MAX_TEXT);
    const blocks = [];
    if (role === "user") {
      for (const img of Array.isArray(m?.images) ? m.images : []) {
        if (!IMAGE_TYPES.includes(img?.mediaType) || typeof img?.data !== "string" || img.data.length > MAX_IMAGE_B64) {
          return res.status(400).json({ error: "Pilt ei sobi (lubatud JPEG, PNG, WebP; kuni umbes 2 MB)." });
        }
        if (++imageCount > MAX_IMAGES_TOTAL) {
          return res.status(400).json({ error: "Liiga palju pilte vestluses (kuni 6). Alusta uut vestlust." });
        }
        blocks.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
      }
    }
    if (text) blocks.push({ type: "text", text });
    if (!blocks.length) continue;
    messages.push({ role, content: blocks });
  }
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return res.status(400).json({ error: "Kirjuta sõnum või lisa pilt." });
  }

  try {
    const userTurns = messages.filter((m) => m.role === "user").length;
    const lastText = messages[messages.length - 1].content.filter((b) => b.type === "text").map((b) => b.text).join(" ");
    const mustPlan = userTurns >= 3 || /planeeri|koosta plaan|tee plaan/i.test(lastText);
    const system =
      systemPrompt(buildContext(classId)) +
      (mustPlan
        ? `\n\nTÄHTIS: nüüd on plaani koostamise aeg. Sa EI TOHI enam küsimusi esitada. Koosta täielik plaan kohe (kokkuvõte, tunnikava, kodutööd, kordamine ja lõpus plan-plokk), tehes mõistlikud eeldused ja nimetades need kokkuvõtte alguses. Kasuta ainult tunniplaani päevi.`
        : "");
    const text = await chatClaude({
      system,
      messages,
      purpose: "planner_chat",
      user: req.user,
      maxTokens: 4000,
    });
    res.json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
