import crypto from "crypto";

/** Segadust tekitavad tähemärgid (0/O, 1/I/L) on välja jäetud — koodi loetakse telefonis ette. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Kooli liitumiskood, nt "K7QM4XPD". */
export function newJoinCode(length = 8) {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** Kutselingi salajane osa. Näidatakse kasutajale ainult üks kord. */
export function newInviteToken() {
  return crypto.randomBytes(32).toString("hex");
}

/** Andmebaasi salvestatakse ainult räsi, mitte token ise. */
export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}
