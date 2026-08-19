import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL, ANTHROPIC_THINKING } from "../constants/ai.js";

/**
 * AI abi eesmärgi sammudeks jagamisel.
 *
 * Mida see TEADLIKULT ei tee: ei saa ega küsi õpilase hindeid, kohalolekut,
 * riskiskoori ega käitumismärkusi. Sisendiks on ainult eesmärgi sõnastus ja
 * eesnimi. Põhjus: mentorluse eesmärk on lapse enda oma, mitte AI arvamus
 * selle kohta, kes see laps on. Andmete kokkukühveldamine "parema soovituse"
 * nimel oleks siin täpselt vale suund (RULE A3).
 *
 * Tagastab ettepaneku. Salvestamine on inimese kutse (RULE A1).
 */
export async function suggestGoalSteps({ studentName, goalTitle }, apiKey) {
  if (!apiKey || !String(apiKey).trim()) {
    return {
      text: null,
      fallback: "Lisa ANTHROPIC_API_KEY, et AI pakuks eesmärgile vahesamme.",
    };
  }

  const firstName = String(studentName).trim().split(/\s+/)[0] || "õpilane";
  const client = new Anthropic({ apiKey: String(apiKey).trim() });

  try {
    const msg = await client.messages.create({
      model: ANTHROPIC_MODEL,
      thinking: ANTHROPIC_THINKING,
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content:
            "Sa aitad õpetajal mentorlusvestlust ette valmistada. Jaga allolev eesmärk " +
            "3-4 konkreetseks vahesammuks, mida õpilane saab ise järgmise kuu jooksul teha. " +
            "Iga samm olgu ühe lausega, mõõdetav ja jõukohane. Lisa lõppu üks küsimus, " +
            "mille õpetaja saab vestluses esitada.\n\n" +
            "Ära oleta midagi õpilase võimete, tausta ega iseloomu kohta — sul ei ole " +
            "selle kohta andmeid ja sa ei tohi neid välja mõelda. Vasta eesti keeles.\n\n" +
            `Õpilane: ${firstName}\nEesmärk: ${goalTitle}`,
        },
      ],
    });

    const block = msg.content?.find((b) => b.type === "text");
    return { text: block ? block.text.trim() : null };
  } catch (err) {
    console.error("[EduAI mentorlus] AI viga:", err?.status, err?.message);
    return {
      text: null,
      fallback: "AI ettepanekut ei saanud laadida. Eesmärgi saad ikka ise kirja panna.",
    };
  }
}
