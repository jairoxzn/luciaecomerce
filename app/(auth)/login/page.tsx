import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/validations/auth";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Iniciar sesión", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  const safe = safeNext(next) ?? undefined;
  if (user) redirect(user.role === "ADMIN" ? "/admin/dashboard" : (safe && !safe.startsWith("/admin") ? safe : "/mi-cuenta"));
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight">Bienvenida de vuelta</h1>
      <p className="mb-8 mt-2 text-stone">Ingresa para ver tus pedidos, favoritos y comprar más rápido.</p>
      <LoginForm next={safe} />
    </>
  );
}
