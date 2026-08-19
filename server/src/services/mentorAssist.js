import { askClaude } from "./aiEngine.js";

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
export async function suggestGoalSteps({ studentName, goalTitle }, user) {
  const firstName = String(studentName).trim().split(/\s+/)[0] || "õpilane";

  return askClaude({
    purpose: "mentor_goal",
    user,
    maxTokens: 600,
    fallback: "AI ettepanekut ei saanud laadida. Eesmärgi saad ikka ise kirja panna.",
    prompt:
      "Sa aitad õpetajal mentorlusvestlust ette valmistada. Jaga allolev eesmärk " +
      "3-4 konkreetseks vahesammuks, mida õpilane saab ise järgmise kuu jooksul teha. " +
      "Iga samm olgu ühe lausega, mõõdetav ja jõukohane. Lisa lõppu üks küsimus, " +
      "mille õpetaja saab vestluses esitada.\n\n" +
      "Ära oleta midagi õpilase võimete, tausta ega iseloomu kohta — sul ei ole " +
      "selle kohta andmeid ja sa ei tohi neid välja mõelda. Vasta eesti keeles.\n\n" +
      `Õpilane: ${firstName}\nEesmärk: ${goalTitle}`,
  });
}
