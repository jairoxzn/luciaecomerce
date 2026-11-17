import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "./session";

export class AuthError extends Error {
  constructor(
    public code: "UNAUTHENTICATED" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
  }
}

/** Para páginas (server components): redirige si no hay sesión. */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

/** Para páginas del panel: solo ADMIN. Un cliente nunca accede. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/dashboard");
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

/** Para server actions / route handlers: lanza AuthError. */
export async function assertUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("UNAUTHENTICATED", "Debes iniciar sesión.");
  return user;
}

export async function assertAdmin(): Promise<SessionUser> {
  const user = await assertUser();
  if (user.role !== "ADMIN") throw new AuthError("FORBIDDEN", "No tienes permisos para esta operación.");
  return user;
}
