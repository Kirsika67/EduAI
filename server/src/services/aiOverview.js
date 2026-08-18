import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL as MODEL, ANTHROPIC_THINKING } from "../constants/ai.js";

/**
 * @param {object} ctx
 * @param {string|null} apiKey
 */
export async function generateDashboardSummary(ctx, apiKey) {
  if (!apiKey || !String(apiKey).trim()) {
    return {
      text: null,
      fallback:
        "Lisa Anthropic API võti serveri keskkonnamuutujaks ANTHROPIC_API_KEY, et kuvada siin lühike AI ülevaade.",
    };
  }

  const client = new Anthropic({ apiKey: String(apiKey).trim() });

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

  try {
    const msg = await client.messages.create({
      model: MODEL,
      thinking: ANTHROPIC_THINKING,
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `Oled õpetaja assistent. Kirjuta 3–4 lühikest lauset eesti keeles: kompaktne ülevaade klassi olukorrast ja 1–2 praktilist järgmist sammu. Ole sõbralik ja konkreetne. Andmed (JSON):\n${userPayload}`,
        },
      ],
    });

    const block = msg.content?.[0];
    const text =
      block && block.type === "text" ? block.text.trim() : "";

    return { text: text || null, fallback: null };
  } catch (err) {
    console.error("[EduAI Anthropic messages.create] VIGA", {
      model: MODEL,
      name: err?.name,
      message: err?.message,
      status: err?.status,
      headers: err?.headers,
      error: err?.error,
      stack: err?.stack,
    });
    throw err;
  }
}
