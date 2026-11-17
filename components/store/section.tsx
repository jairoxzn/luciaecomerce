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
