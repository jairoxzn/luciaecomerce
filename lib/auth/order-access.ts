import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Acceso a pedidos:
 *  - Cliente con sesión: solo sus pedidos.
 *  - Administrador: todos.
 *  - Invitado: cookie firmada (HMAC) con los códigos de pedido que creó o consultó verificando su correo.
 */
const COOKIE = "lj_guest_orders";

function sign(payload: string) {
  return createHmac("sha256", process.env.AUTH_SECRET || "").update(payload).digest("base64url");
}

async function readCodes(): Promise<string[]> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return [];
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return [];
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return [];
  try {
    const codes = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Array.isArray(codes) ? codes.filter((c) => typeof c === "string").slice(0, 20) : [];
  } catch {
    return [];
  }
}

/** Solo en server actions / route handlers (modifica cookies). */
export async function grantGuestAccess(code: string) {
  const codes = Array.from(new Set([code, ...(await readCodes())])).slice(0, 20);
  const payload = Buffer.from(JSON.stringify(codes)).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
}

export async function getAccessibleOrderId(code: string): Promise<string | null> {
  const order = await prisma.order.findUnique({ where: { code }, select: { id: true, userId: true } });
  if (!order) return null;
  const user = await getCurrentUser();
  if (user) {
    if (user.role === "ADMIN" || order.userId === user.id) return order.id;
  }
  if (!order.userId && (await readCodes()).includes(code)) return order.id;
  return null;
}
