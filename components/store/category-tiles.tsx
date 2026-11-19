import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { NavCategory } from "@/lib/services/catalog";

/** Fila de categorías con foto y etiqueta en píldora blanca (usa la imagen de cada categoría; sin imagen, un fondo de marca). */
export function CategoryTiles({ categories }: { categories: NavCategory[] }) {
  const list = categories.filter((c) => c.showOnHome).slice(0, 4);
  if (list.length === 0) return null;
  return (
    <section aria-label="Categorías" className="container-page py-5 sm:py-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {list.map((c) => (
          <Link key={c.id} href={`/categorias/${c.slug}`} className="group relative block aspect-[16/10] overflow-hidden rounded-2xl bg-gradient-to-br from-brand-tint to-brand-soft shadow-card sm:aspect-[2/1]">
            {c.imageUrl && <Image src={c.imageUrl} alt="" fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover transition duration-700 group-hover:scale-105" />}
            <span className="absolute inset-x-0 bottom-3 flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-ink shadow-card transition group-hover:bg-brand group-hover:text-white sm:px-5 sm:text-xs">
                {c.name}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
