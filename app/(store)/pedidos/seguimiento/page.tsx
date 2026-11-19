import type { Metadata } from "next";
import { TrackForm } from "./track-form";

// Se renderiza en cada petición (los datos salen de la caché de Redis): el build no consulta la base de datos
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Seguimiento de pedido", description: "Consulta el estado de tu pedido con tu código y correo.", robots: { index: false } };

export default function TrackPage() {
  return (
    <div className="container-page max-w-lg py-12 sm:py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">Seguimiento de pedido</h1>
      <p className="mb-8 mt-2 text-stone">Ingresa tu código de pedido y el correo con el que compraste.</p>
      <TrackForm />
    </div>
  );
}
