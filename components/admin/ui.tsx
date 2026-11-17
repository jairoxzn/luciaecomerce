import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-stone">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, action, children, className, padded = true }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cn("rounded-2xl border border-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          {title && <h2 className="font-semibold">{title}</h2>}
          {action}
        </header>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, Icon, tone = "brand", href }: { label: string; value: string; hint?: string; Icon: LucideIcon; tone?: "brand" | "green" | "amber" | "sky" | "violet"; href?: string }) {
  const tones = { brand: "bg-brand-tint text-brand", green: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", sky: "bg-sky-50 text-sky-600", violet: "bg-violet-50 text-violet-600" };
  const body = (
    <div className="flex items-start gap-4 rounded-2xl border border-neutral-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:shadow-md">
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", tones[tone])}><Icon className="h-6 w-6" /></span>
      <div className="min-w-0">
        <p className="text-sm text-stone">{label}</p>
        <p className="truncate text-2xl font-extrabold tracking-tight">{value}</p>
        {hint && <p className="text-xs text-stone">{hint}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Table({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">{children}</table></div>;
}
export const Th = ({ children, className }: { children?: React.ReactNode; className?: string }) => <th className={cn("whitespace-nowrap bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone first:rounded-tl-xl last:rounded-tr-xl", className)}>{children}</th>;
export const Td = ({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) => <td colSpan={colSpan} className={cn("border-t border-neutral-100 px-4 py-3 align-middle", className)}>{children}</td>;

export function TableEmpty({ cols, text = "No hay registros para mostrar." }: { cols: number; text?: string }) {
  return <tr><Td colSpan={cols} className="py-12 text-center text-stone">{text}</Td></tr>;
}

export function FilterTabs({ tabs, current, hrefFor }: { tabs: { value: string; label: string; count?: number }[]; current: string; hrefFor: (v: string) => string }) {
  return (
    <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
      {tabs.map((t) => (
        <Link key={t.value} href={hrefFor(t.value)} className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-medium transition", current === t.value ? "bg-ink text-white" : "bg-white text-stone ring-1 ring-neutral-200 hover:text-ink")}>
          {t.label}{t.count !== undefined && <span className={cn("ml-2 rounded-full px-1.5 text-xs", current === t.value ? "bg-white/20" : "bg-neutral-100")}>{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}

/** Formulario GET de búsqueda (sin JS) */
export function SearchForm({ placeholder = "Buscar…", name = "q", defaultValue, hidden }: { placeholder?: string; name?: string; defaultValue?: string; hidden?: Record<string, string | undefined> }) {
  return (
    <form className="flex gap-2" role="search">
      {Object.entries(hidden ?? {}).map(([k, v]) => v ? <input key={k} type="hidden" name={k} value={v} /> : null)}
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} aria-label={placeholder} className="h-10 w-full min-w-0 rounded-full border border-neutral-200 bg-white px-4 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10 sm:w-72" />
      <button className="h-10 rounded-full bg-ink px-5 text-sm font-semibold text-white hover:bg-neutral-800">Buscar</button>
    </form>
  );
}

export function ColorDot({ hex, className }: { hex: string; className?: string }) {
  return <span className={cn("inline-block h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/15", className)} style={{ background: hex }} aria-hidden />;
}
