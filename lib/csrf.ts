/**
 * Protección CSRF para route handlers que mutan datos:
 * la cookie de sesión es SameSite=Lax y además se exige que el Origin coincida con el Host.
 * (Las Server Actions de Next.js ya verifican Origin/Host por su cuenta.)
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
