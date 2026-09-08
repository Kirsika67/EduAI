import fs from "fs";
import path from "path";
import db, { DB_PATH } from "../db.js";

/**
 * Öine andmebaasi koopia.
 *
 * Miks üldse: Renderi ketas on püsiv, aga püsiv ketas ei ole varukoopia.
 * Kustutatud klass, katkine migratsioon või vale UPDATE on täpselt sama
 * lõplik nagu kettarike. Seitse päeva koopiaid annab võimaluse tagasi minna.
 *
 * Mida see EI kata: ketta enda kadu. Selle vastu aitab ainult koopia
 * väljaspool Renderit — vt DEPLOY.md, "Varukoopia väljapoole".
 *
 * `db.backup()` on better-sqlite3 oma: teeb järjepideva koopia ka siis, kui
 * keegi parasjagu kirjutab. Faili lihtne kopeerimine seda ei garanteeri.
 */

const KEEP_DAYS = 7;
const INTERVAL_MS = 24 * 60 * 60 * 1000;

function backupDir() {
  return path.join(path.dirname(DB_PATH), "backups");
}

export async function runBackupOnce() {
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });

  const stamp = new Date().toISOString().slice(0, 10);
  const target = path.join(dir, `eduai-${stamp}.db`);

  await db.backup(target);

  /** Rotatsioon: hoia ainult viimased KEEP_DAYS koopiat. */
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("eduai-") && f.endsWith(".db"))
    .sort();

  for (const old of files.slice(0, Math.max(0, files.length - KEEP_DAYS))) {
    fs.unlinkSync(path.join(dir, old));
  }

  return target;
}

/**
 * Käivitab varunduse kohe ja siis iga 24 tunni tagant. Viga logitakse, aga
 * ei võta serverit maha — katkine varundus on halb, mahakukkunud kool hullem.
 */
export function startBackupSchedule() {
  const tick = async () => {
    try {
      const file = await runBackupOnce();
      console.log("[EduAI varundus] koopia tehtud:", file);
    } catch (err) {
      console.error("[EduAI varundus] ebaõnnestus:", err.message);
    }
  };

  tick();
  const timer = setInterval(tick, INTERVAL_MS);
  /** Ei hoia protsessi elus, kui muud tööd pole. */
  timer.unref?.();
  return timer;
}
