import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/validations/auth";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Crear cuenta", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect("/mi-cuenta");
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight">Crea tu cuenta</h1>
      <p className="mb-8 mt-2 text-stone">Guarda tus favoritos, direcciones y sigue tus pedidos.</p>
      <RegisterForm next={safeNext(next) ?? undefined} />
    </>
  );
}
