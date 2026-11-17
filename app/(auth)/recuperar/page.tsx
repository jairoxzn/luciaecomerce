import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/forgot-form";

export const metadata: Metadata = { title: "Recuperar acceso", robots: { index: false } };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight">Recupera tu acceso</h1>
      <p className="mb-8 mt-2 text-stone">Ingresa tu correo y te ayudaremos a crear una nueva contraseña.</p>
      <ForgotForm />
    </>
  );
}
