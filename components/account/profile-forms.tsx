"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { changePasswordAction, updateProfileAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { changePasswordSchema, profileSchema, type ProfileInput } from "@/lib/validations/auth";

export function ProfileForm({ defaults, email }: { defaults: ProfileInput; email: string }) {
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty }, reset } = useForm<ProfileInput>({ resolver: zodResolver(profileSchema) as never, defaultValues: defaults });
  return (
    <form
      noValidate
      className="space-y-4 rounded-3xl border border-neutral-100 bg-white p-5 shadow-card sm:p-6"
      onSubmit={handleSubmit(async (v) => {
        const r = await updateProfileAction(v);
        if (!r.ok) return toast.error(r.error);
        toast.success(r.message ?? "Guardado");
        reset(v);
      })}
    >
      <h2 className="text-lg font-bold">Datos personales</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombres" error={errors.firstName?.message}><Input {...register("firstName")} /></Field>
        <Field label="Apellidos" error={errors.lastName?.message}><Input {...register("lastName")} /></Field>
        <Field label="Celular" error={errors.phone?.message}><Input type="tel" {...register("phone")} /></Field>
        <Field label="DNI (opcional)" error={errors.dni?.message}><Input inputMode="numeric" maxLength={8} {...register("dni")} /></Field>
        <Field label="Correo electrónico" hint="Para cambiar tu correo contáctanos." className="sm:col-span-2"><Input value={email} disabled readOnly /></Field>
      </div>
      <Button type="submit" loading={isSubmitting} disabled={!isDirty}>Guardar cambios</Button>
    </form>
  );
}

type PwV = { currentPassword: string; newPassword: string; confirmPassword: string };

export function PasswordForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<PwV>({ resolver: zodResolver(changePasswordSchema) as never, defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });
  return (
    <form
      noValidate
      className="space-y-4 rounded-3xl border border-neutral-100 bg-white p-5 shadow-card sm:p-6"
      onSubmit={handleSubmit(async (v) => {
        const r = await changePasswordAction(v);
        if (!r.ok) return toast.error(r.error);
        toast.success(r.message ?? "Contraseña actualizada");
        reset();
      })}
    >
      <h2 className="text-lg font-bold">Cambiar contraseña</h2>
      <Field label="Contraseña actual" error={errors.currentPassword?.message}><PasswordInput autoComplete="current-password" {...register("currentPassword")} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nueva contraseña" error={errors.newPassword?.message}><PasswordInput autoComplete="new-password" {...register("newPassword")} /></Field>
        <Field label="Confirmar" error={errors.confirmPassword?.message}><PasswordInput autoComplete="new-password" {...register("confirmPassword")} /></Field>
      </div>
      <p className="text-xs text-stone">Al cambiarla, se cerrarán tus sesiones en otros dispositivos.</p>
      <Button type="submit" variant="dark" loading={isSubmitting}>Actualizar contraseña</Button>
    </form>
  );
}
