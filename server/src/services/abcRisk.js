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
 * ABC varajane hoiatus: Attendance, Behavior, Course.
 * Tagastab läbipaistva selgituse — õpetaja näeb alati, miks tase on selline.
 */
export function computeAbcRisk({
  grades = [],
  attendance = [],
  behavior = [],
  wellbeing = [],
}) {
  const reasons = [];
  const chronological = [...grades].sort((a, b) => {
    const ta = parseDay(a.date) ?? 0;
    const tb = parseDay(b.date) ?? 0;
    return ta - tb;
  });

  let course = "ok";
  const red = chronological.length >= 3 && hasRedStreak(chronological);
  const trend = monthWindowTrend(chronological);
  const avg = mean(chronological.map((g) => Number(g.score)));

  if (red) {
    course = "high";
    reasons.push("Kolm järjestikust hinnet alla 50%");
  } else if (avg != null && avg < 60) {
    course = "medium";
    reasons.push(`Kursuse keskmine on ${Math.round(avg)}%`);
  } else if (trend === "yellow") {
    course = "medium";
    reasons.push("Keskmine on viimase kuu jooksul langenud üle 15%");
  } else if (trend === "green") {
    course = "improving";
    reasons.push("Keskmine on viimase kuu jooksul tõusnud üle 15%");
  }

  const recentAtt = attendance.filter((r) => inLastDays(r.date, 30));
  const absences = recentAtt.filter((r) => r.status === "absent").length;
  const lates = recentAtt.filter((r) => r.status === "late").length;
  let att = "ok";
  if (absences >= 3) {
    att = "high";
    reasons.push(`${absences} puudumist viimase 30 päeva jooksul`);
  } else if (absences >= 2 || lates >= 3) {
    att = "medium";
    reasons.push(
      absences >= 2
        ? `${absences} puudumist viimase 30 päeva jooksul`
        : `${lates} hilinemist viimase 30 päeva jooksul`
    );
  }

  const recentBeh = behavior.filter((r) => inLastDays(r.date, 30));
  const incidents = recentBeh.filter((r) => r.kind === "incident").length;
  const concerns = recentBeh.filter((r) => r.kind === "concern").length;
  let beh = "ok";
  if (incidents >= 1) {
    beh = "high";
    reasons.push("Distsiplinaarjuhtum viimase 30 päeva jooksul");
  } else if (concerns >= 2) {
    beh = "medium";
    reasons.push(`${concerns} muremärkust viimase 30 päeva jooksul`);
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

export function abcForStudent(db, studentId) {
  return computeAbcRisk(loadAbcInputs(db, studentId));
}
