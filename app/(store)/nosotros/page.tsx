import type { Metadata } from "next";
import Image from "next/image";
import { getSettings } from "@/lib/services/settings";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Nosotros", description: "Conoce la historia y los valores de LUCIA JEANS.", alternates: { canonical: "/nosotros" } };
// Se renderiza en cada petición (los datos salen de la caché de Redis): el build no consulta la base de datos
export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const s = await getSettings();
  return (
    <div className="container-page py-10 sm:py-16">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <p className="font-script text-3xl font-semibold text-brand">Sobre nosotros</p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">{s.storeName}</h1>
          <p className="mt-2 text-lg font-medium text-stone">{s.slogan}</p>
          <div className="mt-6 space-y-4 whitespace-pre-line leading-relaxed text-stone">{s.aboutText ?? "Pronto compartiremos nuestra historia."}</div>
          <LinkButton href="/catalogo" size="lg" className="mt-8">Ver catálogo</LinkButton>
        </div>
        <div className="relative aspect-[5/4] overflow-hidden rounded-[2rem] bg-brand-tint shadow-soft">
          <Image src="/demo/familia.webp" alt={`Equipo y clientes de ${s.storeName}`} fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
        </div>
      </div>
      <div className="mt-16 grid gap-4 sm:grid-cols-3">
        {[["Moda para todos", "Prendas para mujer, hombre y niños con estilo y comodidad."], ["Calidad y confianza", "Seleccionamos cada prenda cuidando acabados y materiales."], ["Atención cercana", "Te acompañamos antes, durante y después de tu compra."]].map(([t, d]) => (
          <div key={t} className="rounded-3xl bg-brand-tint/60 p-6"><h2 className="font-bold">{t}</h2><p className="mt-1 text-sm text-stone">{d}</p></div>
        ))}
      </div>
    </div>
  );
}
