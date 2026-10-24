import assert from "node:assert/strict";
import {
  DEFAULT_THRESHOLDS,
  cleanThresholds,
  computeAbcRisk,
} from "../src/services/abcRisk.js";

const today = new Date().toISOString().slice(0, 10);
const att = (status, n) => Array.from({ length: n }, () => ({ date: today, status }));

// Vaikepiir: 2 puudumist = keskmine → kollane
let r = computeAbcRisk({ attendance: att("absent", 2) });
assert.equal(r.level, "yellow");

// Õpetaja tõstab piiri 4-ni → 2 puudumist ei hoiata
const lenient = cleanThresholds({ absencesMedium: 4, absencesHigh: 6 });
r = computeAbcRisk({ attendance: att("absent", 2) }, lenient);
assert.equal(r.level, "blue");
assert.equal(r.reasons.length, 0);

// Põhjus sisaldab kasutatud piiri
r = computeAbcRisk({ attendance: att("absent", 4) }, lenient);
assert.equal(r.level, "yellow");
assert.match(r.reasons[0], /piir: 4/);

// Hinde-rida: piir 2 järjestikust alla 40
const strict = cleanThresholds({ streakCount: 2, streakBelow: 40 });
const grades = [
  { score: 30, date: "2026-10-01" },
  { score: 35, date: "2026-10-05" },
];
r = computeAbcRisk({ grades }, strict);
assert.equal(r.components.course, "high");
assert.match(r.reasons[0], /2 järjestikust hinnet alla 40%/);

// Sisend kärbitakse lubatud vahemikku, vigane väärtus → vaikimisi
const c = cleanThresholds({ streakCount: 99, windowDays: "abc", absencesMedium: 9, absencesHigh: 3 });
assert.equal(c.streakCount, 6);
assert.equal(c.windowDays, DEFAULT_THRESHOLDS.windowDays);
assert.equal(c.absencesMedium, 3);

console.log("abcRisk.test OK");
