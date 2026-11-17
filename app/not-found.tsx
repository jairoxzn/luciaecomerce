import Link from "next/link";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-brand-tint/40 px-6 text-center">
      <p className="font-script text-5xl font-semibold text-brand">Ups…</p>
      <h1 className="text-4xl font-extrabold tracking-tight">Página no encontrada</h1>
      <p className="max-w-md text-stone">La página que buscas no existe o fue movida. Vuelve al inicio y sigue descubriendo moda para todos.</p>
      <div className="mt-2 flex gap-3"><LinkButton href="/">Ir al inicio</LinkButton><LinkButton href="/catalogo" variant="outline">Ver catálogo</LinkButton></div>
      <Link href="/contacto" className="text-sm text-stone underline">¿Necesitas ayuda?</Link>
    </div>
  );
}
