import dns from "node:dns/promises";
import net from "node:net";
import db from "../db.js";

/**
 * Väljaminev webhook (nt n8n): iga automatsiooni teavitus saadetakse ka õpetaja enda
 * määratud aadressile. Aadress on kasutaja sisestatud, seega kaitseme SSRF-i vastu:
 * ainult https, ja aadress ei tohi osutada sisevõrku ega serveri enda masinasse.
 * Arenduses (kohalik test): ALLOW_PRIVATE_WEBHOOKS=on lubab ka http ja localhosti.
 */

const allowPrivate = () => String(process.env.ALLOW_PRIVATE_WEBHOOKS).toLowerCase() === "on";

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    if (x === "::1" || x === "::") return true;
    if (x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80")) return true;
    if (x.startsWith("::ffff:")) return isPrivateIp(x.slice(7));
  }
  return false;
}

/** Viskab vea, kui aadress ei kõlba. Tagastab parsitud URL-i. */
export async function assertSafeWebhookUrl(raw) {
  let url;
  try { url = new URL(String(raw || "").trim()); } catch { throw new Error("Aadress ei ole kehtiv URL."); }
  if (!allowPrivate() && url.protocol !== "https:") throw new Error("Webhook aadress peab algama https://");
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Lubatud on ainult https aadress.");
  if (url.username || url.password) throw new Error("Aadressis ei tohi olla kasutajanime ega parooli.");
  if (!allowPrivate()) {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
      throw new Error("See aadress ei ole lubatud.");
    }
    const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
    if (!addrs.length) throw new Error("Aadressi domeeni ei leitud.");
    if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("See aadress ei ole lubatud.");
  }
  return url;
}

const get = db.prepare(`SELECT * FROM webhook_settings WHERE account_id = ?`);
const setStatus = db.prepare(`UPDATE webhook_settings SET last_status = ?, last_at = datetime('now') WHERE account_id = ?`);

export function getWebhookSettings(accountId) {
  return get.get(accountId) || null;
}

/** Saadab ühe sündmuse. Ei viska: tulemus salvestatakse (last_status), et kasutaja näeks. */
export async function sendWebhook(accountId, payload) {
  const cfg = get.get(accountId);
  if (!cfg) return { ok: false, skipped: true };
  try {
    const url = await assertSafeWebhookUrl(cfg.url);
    const body = { ...payload };
    if (!cfg.include_names && body.event === "automation" && body.type === "grade_drop") delete body.body;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, {
      method: "POST",
      redirect: "manual",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "EduAI-webhook/1.0",
        ...(cfg.secret ? { "X-EduAI-Secret": cfg.secret } : {}),
      },
      body: JSON.stringify(body),
    }).finally(() => clearTimeout(timer));
    const status = res.status >= 200 && res.status < 300 ? `OK (${res.status})` : `Viga: vastus ${res.status}`;
    setStatus.run(status, accountId);
    return { ok: res.status >= 200 && res.status < 300, status };
  } catch (err) {
    const status = `Viga: ${err.name === "AbortError" ? "aeg möödus" : err.message}`.slice(0, 200);
    setStatus.run(status, accountId);
    return { ok: false, status };
  }
}
