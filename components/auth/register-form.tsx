"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { registerAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { PasswordInput } from "./password-input";

export function RegisterForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema) as never,
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "", acceptTerms: false as unknown as true },
  });

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        const res = await registerAction(values);
        if (!res.ok) {
          setError(res.error);
          return toast.error(res.error);
        }
        toast.success(res.message ?? "Cuenta creada");
        void useSession.getState().refresh(); // el header y los favoritos se actualizan sin recargar
        router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : res.data!.redirectTo);
        router.refresh();
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombres" error={errors.firstName?.message}><Input autoComplete="given-name" aria-invalid={!!errors.firstName} {...register("firstName")} /></Field>
        <Field label="Apellidos" error={errors.lastName?.message}><Input autoComplete="family-name" aria-invalid={!!errors.lastName} {...register("lastName")} /></Field>
      </div>
      <Field label="Correo electrónico" error={errors.email?.message}><Input type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} /></Field>
      <Field label="Celular" error={errors.phone?.message}><Input type="tel" inputMode="tel" autoComplete="tel" placeholder="987654321" aria-invalid={!!errors.phone} {...register("phone")} /></Field>
      <Field label="Contraseña" error={errors.password?.message} hint="Mínimo 8 caracteres, con letras y números."><PasswordInput autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} /></Field>
      <Field label="Confirmar contraseña" error={errors.confirmPassword?.message}><PasswordInput autoComplete="new-password" aria-invalid={!!errors.confirmPassword} {...register("confirmPassword")} /></Field>
      <div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#E65385]" {...register("acceptTerms")} />
          <span>Acepto los <Link href="/politicas/terminos" target="_blank" className="font-medium text-brand underline">términos y condiciones</Link> y la <Link href="/politicas/privacidad" target="_blank" className="font-medium text-brand underline">política de privacidad</Link>.</span>
        </label>
        {errors.acceptTerms && <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{errors.acceptTerms.message}</p>}
      </div>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Crear cuenta</Button>
      <p className="text-center text-sm text-stone">¿Ya tienes cuenta? <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand hover:underline">Inicia sesión</Link></p>
    </form>
  );
}
