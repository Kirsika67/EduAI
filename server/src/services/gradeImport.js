import * as XLSX from "xlsx";

function stripBom(s) {
  if (s.charCodeAt(0) === 0xfeff) return s.slice(1);
  return s;
}

function normalizeHeader(h) {
  return stripBom(String(h ?? "").trim())
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Tuvastab eraldaja esimese rea põhjal (; eelistatud EE Excelis). */
function detectSep(line) {
  const commas = (line.match(/,/g) || []).length;
  const semis = (line.match(/;/g) || []).length;
  if (semis >= commas && semis > 0) return ";";
  return ",";
}

/** Lihtne CSV rida (ei toeta jutumärkides reavahetusi). */
function parseCsvLine(line, sep) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && c === sep) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

function parseCsv(text) {
  const raw = stripBom(String(text)).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = raw.split("\n").map((l) => l.trimEnd());
  const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
  if (nonEmpty.length < 2) {
    throw new Error(
      "CSV-failis pole piisavalt ridu (vajalik päis ja andmed)."
    );
  }
  const sep = detectSep(nonEmpty[0]);
  const headers = parseCsvLine(nonEmpty[0], sep).map(normalizeHeader);
  const rows = [];
  for (let i = 1; i < nonEmpty.length; i++) {
    const cells = parseCsvLine(nonEmpty[i], sep);
    const row = {};
    headers.forEach((h, j) => {
      row[h] = cells[j] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

function sheetRowsToObjects(rows) {
  if (!rows.length) {
    throw new Error("Tabel on tühi.");
  }
  const headerCells = rows[0].map((c) => normalizeHeader(c));
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const line = rows[r];
    if (!line || !line.some((c) => String(c ?? "").trim() !== "")) continue;
    const o = {};
    headerCells.forEach((h, j) => {
      o[h] = line[j] ?? "";
    });
    out.push(o);
  }
  if (!out.length) {
    throw new Error("Andmeridu pole (ainult päis).");
  }
  return out;
}

export function parseGradeSpreadsheet(buffer, originalName = "") {
  const lower = String(originalName).toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const text = buffer.toString("utf8");
    return parseCsv(text);
  }

  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error("Excelis pole lehte.");
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  return sheetRowsToObjects(rows);
}

const NAME_HEADERS = new Set([
  "nimi",
  "õpilane",
  "opilane",
  "name",
  "student",
  "eesnimi ja perekonnanimi",
  "õpilase nimi",
]);

const ID_HEADERS = new Set([
  "id",
  "opilase id",
  "õpilase id",
  "student_id",
  "opilase_id",
]);

const SCORE_HEADERS = new Set([
  "hinne",
  "punktid",
  "score",
  "tulemus",
  "protsent",
]);

const NOTES_HEADERS = new Set([
  "markus",
  "märkus",
  "märkused",
  "notes",
  "kommentaar",
]);

function pickColumn(row, candidates) {
  for (const key of Object.keys(row)) {
    const nk = normalizeHeader(key);
    if (candidates.has(nk)) return row[key];
  }
  return undefined;
}

export function normalizePersonName(s) {
  return String(s ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * @returns {{ entries: Array<{ studentId: number, score: number, notes: string|null }>, warnings: string[], skipped: Array<{ reason: string, row: number }> }}
 */
export function mapImportRowsToEntries(rawRows, students, startRowNumber = 2) {
  const byNormName = new Map();
  for (const s of students) {
    const k = normalizePersonName(s.name);
    if (!byNormName.has(k)) byNormName.set(k, []);
    byNormName.get(k).push(s);
  }

  const entries = [];
  const warnings = [];
  const skipped = [];

  rawRows.forEach((row, idx) => {
    const rowNum = startRowNumber + idx;
    const idRaw = pickColumn(row, ID_HEADERS);
    const nameRaw = pickColumn(row, NAME_HEADERS);
    const scoreRaw = pickColumn(row, SCORE_HEADERS);
    const notesRaw = pickColumn(row, NOTES_HEADERS);

    let studentId = null;
    if (idRaw != null && String(idRaw).trim() !== "") {
      const n = Number(String(idRaw).replace(",", ".").trim());
      if (Number.isInteger(n) && students.some((s) => s.id === n)) {
        studentId = n;
      } else {
        skipped.push({
          row: rowNum,
          reason: `Tundmatu õpilase ID: ${idRaw}`,
        });
        return;
      }
    } else if (nameRaw != null && String(nameRaw).trim() !== "") {
      const k = normalizePersonName(nameRaw);
      const matches = byNormName.get(k) || [];
      if (matches.length === 1) {
        studentId = matches[0].id;
      } else if (matches.length === 0) {
        skipped.push({
          row: rowNum,
          reason: `Õpilast „${String(nameRaw).trim()}“ ei leitud klassist.`,
        });
        return;
      } else {
        skipped.push({
          row: rowNum,
          reason: `Mitme sama nimega õpilase puhul kasuta veergu „id“ (${String(nameRaw).trim()}).`,
        });
        return;
      }
    } else {
      skipped.push({ row: rowNum, reason: "Puudub nimi või õpilase ID." });
      return;
    }

    const scoreStr = String(scoreRaw ?? "").replace(",", ".").trim();
    if (scoreStr === "") {
      skipped.push({ row: rowNum, reason: "Puudub hinne." });
      return;
    }
    const score = Math.round(Number(scoreStr));
    if (!Number.isInteger(score) || Number.isNaN(score) || score < 0 || score > 110) {
      skipped.push({
        row: rowNum,
        reason: `Kehtetu hinne: ${scoreRaw}`,
      });
      return;
    }

    const notes =
      notesRaw != null && String(notesRaw).trim()
        ? String(notesRaw).trim().slice(0, 2000)
        : null;

    entries.push({ studentId, score, notes });
  });

  const dedup = new Map();
  for (const e of entries) {
    dedup.set(e.studentId, e);
  }
  const finalEntries = [...dedup.values()];
  if (finalEntries.length < entries.length) {
    warnings.push(
      "Mõni õpilane esines failis mitu korda — kasutati viimast rida iga õpilase kohta."
    );
  }

  return { entries: finalEntries, warnings, skipped };
}
