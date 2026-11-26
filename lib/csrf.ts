/**
 * Protección CSRF para route handlers que mutan datos: la cookie de sesión es SameSite=Lax y además se exige que
 * `Origin` coincida con la cabecera `Host` de la petición o con el dominio de NEXT_PUBLIC_SITE_URL (por si un proxy
 * reescribe `Host`). `X-Forwarded-Host` NO se tiene en cuenta: es una cabecera que el cliente puede falsificar.
 * (Las Server Actions de Next.js ya verifican Origin/Host por su cuenta.)
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const allowed = [req.headers.get("host"), hostOf(process.env.NEXT_PUBLIC_SITE_URL)];
  const from = hostOf(origin);
  return !!from && allowed.includes(from);
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}

/**
 * Para GET con efectos (descargas que quedan en la auditoría): rechaza las peticiones que el navegador declara
 * iniciadas desde otro sitio. Los navegadores antiguos no envían la cabecera y se permiten (sigue habiendo sesión).
 */
export function isCrossSite(req: Request): boolean {
  return req.headers.get("sec-fetch-site") === "cross-site";
}
