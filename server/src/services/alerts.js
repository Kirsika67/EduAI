/** @typedef {{ score: number, date: string }} GradeRow */

function mean(nums) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function parseDay(dateStr) {
  const s = String(dateStr).trim();
  const t = Date.parse(s.includes("T") ? s : `${s}T12:00:00`);
  return Number.isNaN(t) ? null : t;
}

/**
 * Kolm järjestikust hindeid alla 50%.
 * @param {GradeRow[]} chronologicalAsc
 */
export function hasRedStreak(chronologicalAsc, count = 3, below = 50) {
  const g = chronologicalAsc;
  for (let i = 0; i <= g.length - count; i++) {
    let all = true;
    for (let j = 0; j < count; j++) {
      if (!(g[i + j].score < below)) { all = false; break; }
    }
    if (all) return true;
  }
  return false;
}

/**
 * Viimase 30 päeva vs eelneva 30 päeva keskmine.
 * @returns {'yellow'|'green'|null}
 */
export function monthWindowTrend(chronologicalAsc, changePct = 15) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const b30 = now - 30 * day;
  const b60 = now - 60 * day;

  const last30 = [];
  const prev30 = [];
  for (const row of chronologicalAsc) {
    const t = parseDay(row.date);
    if (t === null) continue;
    if (t > b30) last30.push(row.score);
    else if (t > b60 && t <= b30) prev30.push(row.score);
  }

  const aNew = mean(last30);
  const aOld = mean(prev30);
  if (aNew === null || aOld === null) return null;
  if (prev30.length === 0 || last30.length === 0) return null;

  if (aOld - aNew > changePct) return "yellow";
  if (aNew - aOld > changePct) return "green";
  return null;
}

/**
 * @param {Array<{ topic_id: number, topic_name: string, avg_score: number }>} topicAvgs
 * @returns {Array<{ topicId: number, topicName: string, averagePercent: number, message: string }>}
 */
export function classTopicWeakAlerts(topicAvgs) {
  const out = [];
  for (const t of topicAvgs) {
    if (t.avg_score < 65) {
      out.push({
        topicId: t.topic_id,
        topicName: t.topic_name,
        averagePercent: Math.round(t.avg_score * 10) / 10,
        message: "Klass vajab kordamist",
      });
    }
  }
  return out;
}
