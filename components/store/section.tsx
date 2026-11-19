import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Section({ title, kicker, href, linkLabel = "Ver todos", children, className, tint }: { title: string; kicker?: string; href?: string; linkLabel?: string; children: React.ReactNode; className?: string; tint?: boolean }) {
  return (
    <section className={cn("py-12 sm:py-16", tint && "bg-brand-tint/50", className)}>
      <div className="container-page">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            {kicker && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand">{kicker}</p>}
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
          </div>
          {href && (
            <Link href={href} className="group inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand">
              {linkLabel}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Sección con título en mayúsculas y barra rosa a la izquierda; enlace «Ver todos →» a la derecha. */
export function BarSection({ title, href, linkLabel = "Ver todos", children, className }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("py-6 sm:py-8", className)}>
      <div className="container-page">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-3 text-lg font-extrabold uppercase tracking-tight sm:text-2xl">
            <span aria-hidden className="h-6 w-1.5 rounded-full bg-brand sm:h-7" />
            {title}
          </h2>
          {href && (
            <Link href={href} className="group inline-flex shrink-0 items-center gap-1 text-sm font-semibold transition hover:text-brand">
              {linkLabel}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
