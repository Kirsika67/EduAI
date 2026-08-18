import jwt from "jsonwebtoken";

/** Seansitoken. Payload hoiab ainult konto ID-d — roll loetakse alati andmebaasist. */
export function signToken(accountId) {
  const secret = process.env.JWT_SECRET || "arendus-vale-võti";
  return jwt.sign({ sub: accountId }, secret, { expiresIn: "7d" });
}
