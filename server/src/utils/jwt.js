import jwt from "jsonwebtoken";

/**
 * Arenduse varuvõti. Kohalikult on see mugavus; pilves on see auk, mille
 * kaudu saab igaüks endale kehtiva tokeni allkirjastada. Seepärast lubab
 * `jwtSecret()` seda AINULT väljaspool tootmist — tootmises katkeb server
 * juba käivitusel (vt `src/index.js`).
 */
const DEV_FALLBACK = "arendus-vale-võti";

export function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET puudub — tootmises ei tohi varuvõtit kasutada.");
  }
  return DEV_FALLBACK;
}

/** Seansitoken. Payload hoiab ainult konto ID-d — roll loetakse alati andmebaasist. */
export function signToken(accountId) {
  return jwt.sign({ sub: accountId }, jwtSecret(), { expiresIn: "7d" });
}
