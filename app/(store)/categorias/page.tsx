import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getNavCategories } from "@/lib/services/catalog";

export const metadata: Metadata = { title: "Categorías", description: "Encuentra tu estilo favorito: mujer, hombre, niños y accesorios.", alternates: { canonical: "/categorias" } };

export default async function CategoriesPage() {
  const categories = await getNavCategories();
  return (
    <div className="container-page py-10 sm:py-14">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Categorías</h1>
        <p className="mt-2 text-stone">Encuentra tu estilo favorito</p>
      </header>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {categories.map((c) => (
          <div key={c.id} className="overflow-hidden rounded-3xl border border-neutral-100 bg-white shadow-card">
            <Link href={`/categorias/${c.slug}`} className="group relative block aspect-[4/5] overflow-hidden bg-brand-tint">
              {c.imageUrl && <Image src={c.imageUrl} alt={c.name} fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover transition duration-700 group-hover:scale-110" />}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
              <span className="absolute bottom-4 left-4 flex items-center gap-2 text-lg font-bold text-white">{c.name} <ArrowRight className="h-4 w-4" /></span>
            </Link>
            <ul className="flex flex-wrap gap-1.5 p-3">
              {c.subcategories.slice(0, 6).map((s) => (
                <li key={s.id}><Link href={`/categorias/${c.slug}?subcategoria=${s.slug}`} className="rounded-full bg-brand-tint px-3 py-1 text-xs font-medium text-brand transition hover:bg-brand hover:text-white">{s.name}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
