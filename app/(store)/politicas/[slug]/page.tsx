import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings, type Settings } from "@/lib/services/settings";

const PAGES: Record<string, { title: string; field: keyof Settings }> = {
  envios: { title: "Política de envíos", field: "shippingPolicy" },
  "cambios-y-devoluciones": { title: "Cambios y devoluciones", field: "returnPolicy" },
  privacidad: { title: "Política de privacidad", field: "privacyPolicy" },
  terminos: { title: "Términos y condiciones", field: "termsAndConditions" },
};

// ISR: se genera en la primera visita y se sirve desde caché (se purga al guardar la configuración)
export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = PAGES[slug];
  return p ? { title: p.title, alternates: { canonical: `/politicas/${slug}` } } : {};
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();
  const s = await getSettings();
  const text = s[page.field] as string | null;
  return (
    <div className="container-page max-w-3xl py-10 sm:py-16">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">{page.title}</h1>
      {text ? <div className="whitespace-pre-line leading-relaxed text-stone">{text}</div> : <p className="text-stone">Esta información aún no ha sido publicada por la tienda.</p>}
    </div>
  );
}
