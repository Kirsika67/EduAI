import { hasRedStreak, monthWindowTrend } from "./alerts.js";

function mean(nums) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function parseDay(dateStr) {
  const s = String(dateStr).trim();
  const t = Date.parse(s.includes("T") ? s : `${s}T12:00:00`);
  return Number.isNaN(t) ? null : t;
}

function inLastDays(dateStr, days) {
  const t = parseDay(dateStr);
  if (t === null) return false;
  return Date.now() - t <= days * 24 * 60 * 60 * 1000;
}

/**
 * Hoiatuse piirid. Vaikeväärtused on algne heuristika (valideerimata) —
 * õpetaja saab neid ise muuta, vt `routes/risk.js`.
 */
export const DEFAULT_THRESHOLDS = {
  streakCount: 3, // mitu järjestikust nõrka hinnet = punane
  streakBelow: 50, // "nõrk" hinne on alla selle %
  courseAvgBelow: 60, // kursuse keskmine alla selle % = keskmine risk
  trendChange: 15, // keskmise muutus (%-punkti) viimase kuu vs eelneva kuu
  windowDays: 30, // kohaloleku ja käitumise vaatluspeaeg
  absencesHigh: 3, // puudumisi = kõrge
  absencesMedium: 2, // puudumisi = keskmine
  latesMedium: 3, // hilinemisi = keskmine
  concernsMedium: 2, // muremärkusi = keskmine
};

/** Lubatud vahemikud — server kärbib kõik sisendid nendesse. */
export const THRESHOLD_LIMITS = {
  streakCount: [2, 6],
  streakBelow: [20, 80],
  courseAvgBelow: [30, 90],
  trendChange: [5, 40],
  windowDays: [7, 90],
  absencesHigh: [1, 15],
  absencesMedium: [1, 15],
  latesMedium: [1, 15],
  concernsMedium: [1, 10],
};

export function cleanThresholds(raw = {}) {
  const out = {};
  for (const [key, def] of Object.entries(DEFAULT_THRESHOLDS)) {
    const [min, max] = THRESHOLD_LIMITS[key];
    const n = Math.round(Number(raw?.[key]));
    out[key] = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  }
  /** "Keskmine" ei tohi olla rangem kui "kõrge". */
  if (out.absencesMedium > out.absencesHigh) out.absencesMedium = out.absencesHigh;
  return out;
}

export function getRiskThresholds(db, accountId) {
  if (accountId == null) return { ...DEFAULT_THRESHOLDS };
  const row = db
    .prepare(`SELECT config FROM risk_settings WHERE account_id = ?`)
    .get(accountId);
  if (!row) return { ...DEFAULT_THRESHOLDS };
  try {
    return cleanThresholds(JSON.parse(row.config));
  } catch {
    return { ...DEFAULT_THRESHOLDS };
  }
}

/**
 * ABC varajane hoiatus: Attendance, Behavior, Course.
 * Tagastab läbipaistva selgituse — õpetaja näeb alati, miks tase on selline.
 */
export function computeAbcRisk(
  { grades = [], attendance = [], behavior = [], wellbeing = [] },
  thresholds = DEFAULT_THRESHOLDS
) {
  const th = cleanThresholds(thresholds);
  const reasons = [];
  const chronological = [...grades].sort((a, b) => {
    const ta = parseDay(a.date) ?? 0;
    const tb = parseDay(b.date) ?? 0;
    return ta - tb;
  });

  let course = "ok";
  const red =
    chronological.length >= th.streakCount &&
    hasRedStreak(chronological, th.streakCount, th.streakBelow);
  const trend = monthWindowTrend(chronological, th.trendChange);
  const avg = mean(chronological.map((g) => Number(g.score)));

  if (red) {
    course = "high";
    reasons.push(
      `${th.streakCount} järjestikust hinnet alla ${th.streakBelow}%`
    );
  } else if (avg != null && avg < th.courseAvgBelow) {
    course = "medium";
    reasons.push(
      `Kursuse keskmine on ${Math.round(avg)}% (piir: alla ${th.courseAvgBelow}%)`
    );
  } else if (trend === "yellow") {
    course = "medium";
    reasons.push(
      `Keskmine on viimase kuu jooksul langenud üle ${th.trendChange}%`
    );
  } else if (trend === "green") {
    course = "improving";
    reasons.push(
      `Keskmine on viimase kuu jooksul tõusnud üle ${th.trendChange}%`
    );
  }

  const recentAtt = attendance.filter((r) => inLastDays(r.date, th.windowDays));
  const absences = recentAtt.filter((r) => r.status === "absent").length;
  const lates = recentAtt.filter((r) => r.status === "late").length;
  let att = "ok";
  if (absences >= th.absencesHigh) {
    att = "high";
    reasons.push(
      `${absences} puudumist viimase ${th.windowDays} päeva jooksul (piir: ${th.absencesHigh})`
    );
  } else if (absences >= th.absencesMedium || lates >= th.latesMedium) {
    att = "medium";
    reasons.push(
      absences >= th.absencesMedium
        ? `${absences} puudumist viimase ${th.windowDays} päeva jooksul (piir: ${th.absencesMedium})`
        : `${lates} hilinemist viimase ${th.windowDays} päeva jooksul (piir: ${th.latesMedium})`
    );
  }

  const recentBeh = behavior.filter((r) => inLastDays(r.date, th.windowDays));
  const incidents = recentBeh.filter((r) => r.kind === "incident").length;
  const concerns = recentBeh.filter((r) => r.kind === "concern").length;
  let beh = "ok";
  if (incidents >= 1) {
    beh = "high";
    reasons.push(
      `Distsiplinaarjuhtum viimase ${th.windowDays} päeva jooksul`
    );
  } else if (concerns >= th.concernsMedium) {
    beh = "medium";
    reasons.push(
      `${concerns} muremärkust viimase ${th.windowDays} päeva jooksul (piir: ${th.concernsMedium})`
    );
  }

  const recentWell = wellbeing.filter((r) => inLastDays(r.date, 28));
  const hardDays = recentWell.filter((r) => r.mood === "hard").length;
  let well = "ok";
  if (hardDays >= 2) {
    well = "medium";
    reasons.push("Korduvalt raske enesetunne (vabatahtlik check-in)");
  }

  const highs = [course, att, beh].filter((x) => x === "high").length;
  const meds = [course, att, beh].filter((x) => x === "medium").length;

  let level = "blue";
  if (highs >= 1 || meds >= 2) level = "red";
  else if (meds >= 1 || well === "medium") level = "yellow";
  else if (course === "improving") level = "green";

  const score = Math.max(
    0,
    Math.min(100, 100 - highs * 40 - meds * 20 - (well === "medium" ? 10 : 0))
  );

  const labels = {
    red: "Tähelepanu",
    yellow: "Tugi vajalik",
    green: "Edasijõudnud",
    blue: "Hea tase",
  };

  /**
   * `score` on ajalooline ja tähendab "kõrgem = parem" — UI värvid sõltuvad sellest.
   * Ehitusjuhend eeldab vastupidist skaalat ("kõrgem = riskantsem"), seega antakse see
   * eraldi väljadena, mitte `score` tähendust muutes. Vt ARHITEKTUUR_JA_PLAAN K3 —
   * skaala vaikne pööramine oleks lõhkunud kõik olemasolevad lõiked ja värvid.
   */
  const riskScore = 100 - score;
  const riskLabel =
    riskScore >= 70 ? "Kõrge risk" : riskScore >= 40 ? "Jälgi" : "Stabiilne";

  return {
    level,
    label: labels[level],
    score,
    riskScore,
    riskLabel,
    reasons,
    components: {
      course,
      attendance: att,
      behavior: beh,
      wellbeing: well,
    },
  };
}

export function loadAbcInputs(db, studentId) {
  const grades = db
    .prepare(
      `SELECT score, date FROM grades WHERE student_id = ? ORDER BY date ASC, id ASC`
    )
    .all(studentId);
  const attendance = db
    .prepare(`SELECT date, status FROM attendance WHERE student_id = ?`)
    .all(studentId);
  const behavior = db
    .prepare(`SELECT date, kind FROM behavior_notes WHERE student_id = ?`)
    .all(studentId);
  const wellbeing = db
    .prepare(`SELECT date, mood FROM wellbeing_checkins WHERE student_id = ?`)
    .all(studentId);
  return { grades, attendance, behavior, wellbeing };
}

/**
 * `thresholds` on valikuline: ilma selleta kasutatakse vaikepiire.
 * Õpetaja enda piirid saab `getRiskThresholds(db, req.user.id)`-ga.
 */
export function abcForStudent(db, studentId, thresholds = DEFAULT_THRESHOLDS) {
  return computeAbcRisk(loadAbcInputs(db, studentId), thresholds);
}
