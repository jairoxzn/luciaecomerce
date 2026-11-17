"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { resetPasswordAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { resetSchema } from "@/lib/validations/auth";
import { PasswordInput } from "./password-input";

type V = { token: string; password: string; confirmPassword: string };

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<V>({ resolver: zodResolver(resetSchema) as never, defaultValues: { token, password: "", confirmPassword: "" } });
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={handleSubmit(async (v) => {
        const r = await resetPasswordAction(v);
        if (!r.ok) return toast.error(r.error);
        toast.success(r.message ?? "Contraseña actualizada");
        router.push("/login");
      })}
    >
      <Field label="Nueva contraseña" error={errors.password?.message} hint="Mínimo 8 caracteres, con letras y números."><PasswordInput autoComplete="new-password" {...register("password")} /></Field>
      <Field label="Confirmar contraseña" error={errors.confirmPassword?.message}><PasswordInput autoComplete="new-password" {...register("confirmPassword")} /></Field>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Guardar contraseña</Button>
    </form>
  );
}
