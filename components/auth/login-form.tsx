"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { PasswordInput } from "./password-input";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) as never, defaultValues: { email: "", password: "", next } });

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        const res = await loginAction(values);
        if (!res.ok) {
          setError(res.error);
          return toast.error(res.error);
        }
        toast.success(res.message ?? "Bienvenida");
        void useSession.getState().refresh(); // el header y los favoritos se actualizan sin recargar
        router.push(res.data!.redirectTo);
        router.refresh();
      })}
    >
      <Field label="Correo electrónico" error={errors.email?.message}><Input type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} /></Field>
      <Field label="Contraseña" error={errors.password?.message}><PasswordInput autoComplete="current-password" aria-invalid={!!errors.password} {...register("password")} /></Field>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
      <div className="text-right"><Link href="/recuperar" className="text-sm font-medium text-brand hover:underline">¿Olvidaste tu contraseña?</Link></div>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Iniciar sesión</Button>
      <p className="text-center text-sm text-stone">¿Aún no tienes cuenta? <Link href={`/registro${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand hover:underline">Regístrate</Link></p>
    </form>
  );
}
