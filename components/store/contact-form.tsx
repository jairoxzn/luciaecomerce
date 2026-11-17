"use client";

import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { sendContactMessageAction } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";

type V = { name: string; email: string; message: string };

export function ContactForm() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<V>({ defaultValues: { name: "", email: "", message: "" } });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        const r = await sendContactMessageAction(v);
        if (!r.ok) return toast.error(r.error);
        toast.success(r.message ?? "Enviado");
        reset();
      })}
    >
      <Field label="Nombre" error={errors.name?.message}><Input autoComplete="name" {...register("name", { required: "Ingresa tu nombre", minLength: { value: 2, message: "Mínimo 2 caracteres" } })} /></Field>
      <Field label="Correo" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email", { required: "Ingresa tu correo", pattern: { value: /^\S+@\S+\.\S+$/, message: "Correo inválido" } })} /></Field>
      <Field label="Mensaje" error={errors.message?.message}><Textarea rows={5} maxLength={2000} {...register("message", { required: "Escribe tu mensaje", minLength: { value: 10, message: "Mínimo 10 caracteres" } })} /></Field>
      <Button type="submit" size="lg" className="w-full sm:w-auto" loading={isSubmitting}>Enviar mensaje</Button>
    </form>
  );
}
