"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { forgotPasswordAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { forgotSchema } from "@/lib/validations/auth";

export function ForgotForm() {
  const [done, setDone] = useState<{ emailConfigured: boolean } | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(forgotSchema) as never, defaultValues: { email: "" } });

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-tint text-brand"><MailCheck className="h-8 w-8" /></span>
        <h2 className="text-xl font-bold">Revisa tu solicitud</h2>
        {done.emailConfigured ? (
          <p className="text-sm text-stone">Si el correo está registrado, te enviamos un enlace para crear una nueva contraseña. Vence en 1 hora.</p>
        ) : (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">El envío automático de correos aún no está configurado en esta tienda. Escríbenos desde <Link href="/contacto" className="font-semibold underline">Contacto</Link> y la administración generará tu enlace de recuperación.</p>
        )}
        <Link href="/login" className="inline-block text-sm font-semibold text-brand hover:underline">Volver a iniciar sesión</Link>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={handleSubmit(async (v) => {
        const r = await forgotPasswordAction(v);
        if (!r.ok) return toast.error(r.error);
        setDone(r.data ?? { emailConfigured: false });
      })}
    >
      <Field label="Correo electrónico" error={errors.email?.message}><Input type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} /></Field>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Enviar enlace de recuperación</Button>
      <p className="text-center text-sm"><Link href="/login" className="font-medium text-brand hover:underline">← Volver a iniciar sesión</Link></p>
    </form>
  );
}
