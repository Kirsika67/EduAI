import { askClaude } from "./aiEngine.js";

/**
 * Klassi AI-ülevaade Ülevaate lehele.
 *
 * Käib läbi `aiEngine`, nagu kõik teised AI-kutsed: üks mudeli ID, üks
 * veakäsitlus, üks kasutuslogi (Faas 8).
 *
 * @param {object} ctx
 * @param {string[]} [ctx.studentNames]
 *        Klassi õpilaste nimed. Hoiatuste kokkuvõttes on nimed sees, seega
 *        need tuleb pseudonümiseerida — mootor teeb selle ise, aga ainult
 *        siis, kui talle öeldakse, millised nimed tekstis olla võivad.
 * @param {object} [user] req.user — kasutuslogi jaoks
 */
export async function generateDashboardSummary(ctx, user) {
  const userPayload = JSON.stringify(
    {
      klass: ctx.className,
      aine: ctx.subject,
      naitajad: ctx.metrics,
      hoiatusi_kokkuvote: ctx.alertSummary,
      teema_keskmised: ctx.topicAvgs,
    },
    null,
    0
  );

  return askClaude({
    purpose: "class_overview",
    user,
    maxTokens: 600,
    protectedNames: ctx.studentNames || [],
    fallback: "AI ülevaadet ei saanud laadida. Näitajad on ülal ka ilma selleta.",
    prompt:
      "Oled õpetaja assistent. Kirjuta 3–4 lühikest lauset eesti keeles: kompaktne " +
      "ülevaade klassi olukorrast ja 1–2 praktilist järgmist sammu. Ole sõbralik ja " +
      `konkreetne. Andmed (JSON):\n${userPayload}`,
  });
}
