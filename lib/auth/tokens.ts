import { createHmac, randomBytes } from "crypto";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH_SECRET no está configurado (mínimo 16 caracteres). Genera uno con: openssl rand -base64 32");
  }
  return s;
}

export function newToken() {
  return randomBytes(32).toString("base64url");
}

/** HMAC-SHA256 del token con AUTH_SECRET: en BD solo se guarda el hash, nunca el token. */
export function hashToken(token: string) {
  return createHmac("sha256", secret()).update(token).digest("hex");
}
