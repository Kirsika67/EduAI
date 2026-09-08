/**
 * Turvakiht — ilma lisasõltuvusteta.
 *
 * Miks mitte `helmet` ja `express-rate-limit`: need on head teegid, aga see
 * fail teeb täpselt selle, mida EduAI vajab, ~100 real ja ilma uue
 * sõltuvuseta, mida peaks uuendama ja auditeerima. Kui vajadus kasvab
 * (mitu instantsi, Redis-põhine loendur), on need teegid õige samm.
 */

const isProduction = () => process.env.NODE_ENV === "production";

/**
 * Turvapäised. CSP on tahtlikult kitsas: rakendus laeb kõik oma varad
 * samast domeenist, väliseid skripte ega fonte ei ole.
 *
 * `style-src 'unsafe-inline'` on sees, sest React kirjutab `style=""`
 * atribuute (progressiribad, värvid). Skriptide puhul seda luba EI ole —
 * see on koht, kus XSS päriselt haiget teeks.
 */
export function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ")
  );

  if (isProduction() && req.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }

  next();
}

/**
 * HTTP → HTTPS. Renderi ees on proxy, seega päris protokoll on
 * `x-forwarded-proto` päises (`app.set("trust proxy", 1)` teeb selle
 * `req.secure`-ile nähtavaks).
 */
export function forceHttps(req, res, next) {
  if (!isProduction() || req.secure) return next();
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(403).json({ error: "Kasuta HTTPS-ühendust." });
  }
  return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
}

/**
 * Lihtne libisev aken mälus. Üks Renderi instants = üks loendur, millest
 * selle rakenduse mahus piisab. Mitme instantsi puhul tuleb see asendada
 * jagatud loenduriga (Redis) — muidu korrutub limiit instantside arvuga.
 *
 * @param {object} opts
 * @param {number} opts.windowMs
 * @param {number} opts.max
 * @param {string} [opts.message]
 * @param {(req: import('express').Request) => string} [opts.keyOf]
 */
export function rateLimit({ windowMs, max, message, keyOf }) {
  /** key → number[] (ajatemplid) */
  const hits = new Map();
  let lastSweep = Date.now();

  /** Vana koristus, et Map ei kasvaks lõputult. */
  function sweep(now) {
    if (now - lastSweep < windowMs) return;
    lastSweep = now;
    for (const [key, stamps] of hits) {
      const kept = stamps.filter((t) => now - t < windowMs);
      if (kept.length) hits.set(key, kept);
      else hits.delete(key);
    }
  }

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    sweep(now);

    const key = keyOf ? keyOf(req) : req.ip || "tundmatu";
    const stamps = (hits.get(key) || []).filter((t) => now - t < windowMs);

    if (stamps.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - stamps[0])) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: message || "Liiga palju päringuid. Proovi natukese aja pärast uuesti.",
      });
    }

    stamps.push(now);
    hits.set(key, stamps);
    next();
  };
}

/**
 * Sisselogimine ja registreerimine: kaitse paroolide äraarvamise vastu.
 * Piir on teadlikult lahke — õpetaja, kes oma parooli kolm korda valesti
 * kirjutab, ei tohi end koolipäeva keskel välja lukustada.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Liiga palju sisselogimiskatseid. Oota 15 minutit ja proovi uuesti.",
});

/**
 * Seansi võti loenduri jaoks. Koolis on kõik õpetajad sama IP taga, seega
 * IP üksi oleks liiga jäme: ühe õpetaja tsükkel piiraks tervet maja.
 * Bearer-token on seansi kohta unikaalne ja käepärast juba enne
 * `requireAuth`-i.
 */
function sessionKey(req) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    /** Ainult sõrmejälg, mitte token ise — see ei tohi mällu ega logisse jääda. */
    const token = header.slice(7);
    return `t:${token.length}:${token.slice(-12)}`;
  }
  return `ip:${req.ip || "tundmatu"}`;
}

/**
 * Üldine lagi kogu API-le. Ei ole mõeldud inimese piiramiseks — normaalne
 * lehe sirvimine jääb sellest kaugele alla. Eesmärk on peatada katkine
 * tsükkel frontendis või skript, mis muidu kulutaks AI-krediiti terve öö.
 */
export const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 400,
  message: "Liiga palju päringuid järjest. Värskenda lehte ja proovi uuesti.",
  keyOf: sessionKey,
});
