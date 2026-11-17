import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/reset-form";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false } };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight">Crea una nueva contraseña</h1>
      <p className="mb-8 mt-2 text-stone">Elige una contraseña segura que no uses en otros sitios.</p>
      <ResetForm token={token} />
    </>
  );
}
