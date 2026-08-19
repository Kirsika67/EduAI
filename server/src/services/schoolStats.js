import { summariseAttendance } from "./attendanceStats.js";
import { abcForStudent } from "./abcRisk.js";

/**
 * Kooli koondnäitajad juhtkonnale.
 *
 * Puhas arvutus, mitte AI. Kaks piiri, mis on siia teadlikult sisse ehitatud:
 *
 *  1. Klasse EI panda pingeritta. Näitajad on olemas, aga sorteerimine
 *     "parimast halvimani" muudaks selle õpetajate edetabeliks — see on
 *     juhtimisvahend, mida keegi ei tellinud ja mis muudaks andmete
 *     sisestamise ohtlikuks. Klassid tulevad nime järgi.
 *  2. Kooli vaade näitab AINULT selle kooli andmeid (`school_id`), sest ilma
 *     selleta tähendaks "kooli ülevaade" kõiki andmebaasi klasse (vt K5).
 */

/** Alla selle õpilaste arvu klassis ei näidata koondnumbrit — see oleks isikustatud. */
const MIN_CLASS_SIZE_FOR_STATS = 3;

export function schoolOverview(db, schoolId) {
  const classes = db
    .prepare(
      `SELECT c.id, c.name, c.subject, c.teacher_id, t.name AS teacher_name
       FROM classes c
       JOIN teachers t ON t.id = c.teacher_id
       WHERE t.school_id = ?
       ORDER BY c.name COLLATE NOCASE`
    )
    .all(schoolId);

  const classIds = classes.map((c) => c.id);
  if (!classIds.length) {
    return {
      totals: { classes: 0, students: 0, staff: 0, families: 0 },
      attendance: { attendedPercent: null, chronicCount: 0 },
      risk: { green: 0, yellow: 0, red: 0, blue: 0 },
      classes: [],
      needsAttention: [],
    };
  }

  const placeholders = classIds.map(() => "?").join(", ");

  const students = db
    .prepare(`SELECT id, name, class_id FROM students WHERE class_id IN (${placeholders})`)
    .all(...classIds);

  const staffCount = db
    .prepare(
      `SELECT COUNT(*) AS n FROM teachers
       WHERE school_id = ? AND role NOT IN ('parent', 'student')`
    )
    .get(schoolId).n;

  const familyCount = db
    .prepare(
      `SELECT COUNT(*) AS n FROM teachers
       WHERE school_id = ? AND role IN ('parent', 'student')`
    )
    .get(schoolId).n;

  const attendanceRows = db
    .prepare(
      `SELECT a.student_id, a.date, a.status FROM attendance a
       JOIN students s ON s.id = a.student_id
       WHERE s.class_id IN (${placeholders})`
    )
    .all(...classIds);

  const attendanceByStudent = new Map();
  for (const r of attendanceRows) {
    if (!attendanceByStudent.has(r.student_id)) attendanceByStudent.set(r.student_id, []);
    attendanceByStudent.get(r.student_id).push(r);
  }

  const risk = { green: 0, yellow: 0, red: 0, blue: 0 };
  const perClass = new Map(
    classes.map((c) => [
      c.id,
      { students: 0, attendedSum: 0, attendedCount: 0, chronic: 0, red: 0, yellow: 0 },
    ])
  );
  const needsAttention = [];
  let chronicCount = 0;
  let attendedSum = 0;
  let attendedCount = 0;

  for (const st of students) {
    const bucket = perClass.get(st.class_id);
    if (bucket) bucket.students += 1;

    const summary = summariseAttendance(attendanceByStudent.get(st.id) || []);
    if (summary.attendedPercent !== null) {
      attendedSum += summary.attendedPercent;
      attendedCount += 1;
      if (bucket) {
        bucket.attendedSum += summary.attendedPercent;
        bucket.attendedCount += 1;
      }
    }
    if (summary.isChronic) {
      chronicCount += 1;
      if (bucket) bucket.chronic += 1;
    }

    const abc = abcForStudent(db, st.id);
    if (risk[abc.level] !== undefined) risk[abc.level] += 1;
    if (bucket && abc.level === "red") bucket.red += 1;
    if (bucket && abc.level === "yellow") bucket.yellow += 1;

    if (abc.level === "red" || summary.isChronic) {
      needsAttention.push({
        studentId: st.id,
        studentName: st.name,
        className: classes.find((c) => c.id === st.class_id)?.name || "",
        riskLabel: abc.riskLabel,
        level: abc.level,
        attendedPercent: summary.attendedPercent,
        isChronic: summary.isChronic,
      });
    }
  }

  return {
    totals: {
      classes: classes.length,
      students: students.length,
      staff: staffCount,
      families: familyCount,
    },
    attendance: {
      attendedPercent: attendedCount ? Math.round(attendedSum / attendedCount) : null,
      chronicCount,
    },
    risk,
    /** Nime järgi, mitte tulemuse järgi — vt kommentaari faili alguses. */
    classes: classes.map((c) => {
      const b = perClass.get(c.id);
      const tooSmall = b.students < MIN_CLASS_SIZE_FOR_STATS;
      return {
        classId: c.id,
        name: c.name,
        subject: c.subject,
        teacherName: c.teacher_name,
        students: b.students,
        attendedPercent:
          tooSmall || !b.attendedCount ? null : Math.round(b.attendedSum / b.attendedCount),
        chronic: tooSmall ? null : b.chronic,
        red: tooSmall ? null : b.red,
        yellow: tooSmall ? null : b.yellow,
        hidden: tooSmall,
      };
    }),
    needsAttention: needsAttention.sort((a, b) => {
      if (a.level !== b.level) return a.level === "red" ? -1 : 1;
      return (a.attendedPercent ?? 100) - (b.attendedPercent ?? 100);
    }),
    minClassSizeForStats: MIN_CLASS_SIZE_FOR_STATS,
  };
}
