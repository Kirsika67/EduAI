/**
 * Kohaloleku statistika. Puhas JavaScript, mitte AI — protsent peab olema
 * alati sama arv ja õpetaja peab saama selle ise üle kontrollida (RULE A2).
 *
 * Kaks otsust, mis ei ole ilmselged:
 *  - `excused` (vabastatud) EI lähe nimetajasse. Ametlikult vabastatud tund ei
 *    ole puudumine ja ei tohi kohaloleku protsenti alla tõmmata.
 *  - `late` (hilines) loeb kohalolekuks — laps oli kohal. Hilinemisi loendatakse
 *    eraldi, sest muster on omaette signaal.
 */

const CHRONIC_THRESHOLD_PERCENT = 20;

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
 * @param {Array<{date: string, status: string}>} rows
 * @param {{ days?: number }} [opts]
 */
export function summariseAttendance(rows, { days = 30 } = {}) {
  const recent = rows.filter((r) => inLastDays(r.date, days));

  const counts = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const r of recent) {
    if (counts[r.status] !== undefined) counts[r.status] += 1;
  }

  /** Vabastatud tunnid jäävad arvestusest välja. */
  const counted = counts.present + counts.late + counts.absent;
  const attendedPercent =
    counted > 0 ? Math.round(((counts.present + counts.late) / counted) * 100) : null;
  const absencePercent =
    counted > 0 ? Math.round((counts.absent / counted) * 100) : 0;

  return {
    days,
    recordCount: recent.length,
    counted,
    present: counts.present,
    late: counts.late,
    absent: counts.absent,
    excused: counts.excused,
    attendedPercent,
    absencePercent,
    isChronic: counted >= 5 && absencePercent >= CHRONIC_THRESHOLD_PERCENT,
  };
}

/** Päevade kaupa jada mini-graafiku jaoks (vanemast uuemani). */
export function dailySeries(rows, days = 30) {
  const byDate = new Map();
  for (const r of rows) {
    if (!inLastDays(r.date, days)) continue;
    const day = String(r.date).slice(0, 10);
    const cur = byDate.get(day) || { date: day, present: 0, late: 0, absent: 0, excused: 0 };
    if (cur[r.status] !== undefined) cur[r.status] += 1;
    byDate.set(day, cur);
  }
  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      /** Päeva üldstaatus graafiku jaoks: halvim selle päeva kirjetest. */
      status: d.absent ? "absent" : d.late ? "late" : d.excused ? "excused" : "present",
    }));
}

export { CHRONIC_THRESHOLD_PERCENT };
