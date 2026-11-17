import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

/**
 * Primera barrera de protección de rutas (rápida, sin base de datos): exige cookie de sesión.
 * La validación REAL de la sesión y del rol ADMIN se hace en el servidor
 * (requireAdmin / assertAdmin) en cada layout, página y acción.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = !!req.cookies.get(SESSION_COOKIE)?.value;
  if (!hasSession && (pathname.startsWith("/admin") || pathname.startsWith("/mi-cuenta"))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  if (pathname.startsWith("/admin")) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = { matcher: ["/admin/:path*", "/mi-cuenta/:path*"] };
