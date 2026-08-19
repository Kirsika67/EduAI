import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import db from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { schoolOverview } from "../services/schoolStats.js";
import { LEADERSHIP_ROLES } from "../constants/roles.js";
import { ANTHROPIC_MODEL, ANTHROPIC_THINKING } from "../constants/ai.js";

const router = Router();
router.use(requireAuth);

/** Kogu kooli vaade on juhtkonnale. Aineõpetaja näeb oma klasse mujal. */
const requireLeadership = requireRole(LEADERSHIP_ROLES);

router.get("/overview", requireLeadership, (req, res) => {
  if (req.user.schoolId == null) {
    return res.status(400).json({ error: "Sinu konto pole kooliga seotud." });
  }

  const school = db
    .prepare(`SELECT id, name FROM schools WHERE id = ?`)
    .get(req.user.schoolId);
  const data = schoolOverview(db, req.user.schoolId);

  audit(req, { action: "school.view_overview", entityType: "school", entityId: req.user.schoolId });

  res.json({ school: { id: school?.id, name: school?.name }, ...data });
});

/**
 * AI kokkuvõte juhtkonnale.
 *
 * Saadab AINULT koondarvud — ühtegi õpilase nime ega üksikandmeid. Juhtkonna
 * kokkuvõte on koolist, mitte lastest; nimede saatmine oleks siin tarbetu
 * isikuandmete töötlus, mis ei muudaks vastust paremaks (RULE A3).
 */
router.post("/ai-summary", requireLeadership, async (req, res) => {
  if (req.user.schoolId == null) {
    return res.status(400).json({ error: "Sinu konto pole kooliga seotud." });
  }

  const data = schoolOverview(db, req.user.schoolId);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || !String(apiKey).trim()) {
    return res.json({
      summary: null,
      fallback: "Lisa ANTHROPIC_API_KEY, et näha AI koondhinnangut.",
    });
  }

  const anonymous = {
    klasse: data.totals.classes,
    opilasi: data.totals.students,
    keskmine_kohalolek_protsent: data.attendance.attendedPercent,
    kroonilisi_puudujaid: data.attendance.chronicCount,
    riskijaotus: data.risk,
    klasside_kohalolek: data.classes
      .filter((c) => !c.hidden)
      .map((c) => ({ klass: c.name, kohalolek: c.attendedPercent, korgel_riskil: c.red })),
  };

  try {
    const client = new Anthropic({ apiKey: String(apiKey).trim() });
    const msg = await client.messages.create({
      model: ANTHROPIC_MODEL,
      thinking: ANTHROPIC_THINKING,
      max_tokens: 700,
      messages: [
        {
          role: "user",
          content:
            "Sa oled kooli juhtkonna analüütik. Allpool on ühe kooli koondnäitajad " +
            "(ilma nimedeta). Kirjuta 3-4 lauset: mis on kõige selgem signaal, kus on " +
            "kitsaskoht ja milline oleks üks konkreetne järgmine samm juhtkonnale.\n\n" +
            "Ära nimeta ega oleta ühtegi õpetajat ega õpilast. Ära tee järeldusi " +
            "õpetajate töö kvaliteedi kohta — kohaloleku ja riski taga on tavaliselt " +
            "asjaolud, mida need arvud ei näita. Vasta eesti keeles.\n\n" +
            `Andmed (JSON): ${JSON.stringify(anonymous)}`,
        },
      ],
    });

    const block = msg.content?.find((b) => b.type === "text");
    audit(req, { action: "school.ai_summary", entityType: "school", entityId: req.user.schoolId });
    res.json({ summary: block ? block.text.trim() : null, fallback: null });
  } catch (err) {
    console.error("[EduAI kooli ülevaade] AI viga:", err?.status, err?.message);
    res.json({
      summary: null,
      fallback: "AI kokkuvõtet ei saanud laadida. Numbrid on ülal ka ilma selleta.",
    });
  }
});

export default router;
