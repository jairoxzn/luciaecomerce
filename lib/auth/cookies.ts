/**
 * Las cookies de sesión y de pedidos de invitado llevan `Secure` SIEMPRE en producción, sin depender de que
 * NEXT_PUBLIC_SITE_URL esté bien escrita. `COOKIE_SECURE=false` solo para servir por HTTP a propósito
 * (p. ej. Docker en una red local sin TLS); en http://localhost los navegadores ya aceptan cookies `Secure`.
 */
export function secureCookies(): boolean {
  const forced = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (forced === "true") return true;
  if (forced === "false") return false;
  return process.env.NODE_ENV === "production";
}
