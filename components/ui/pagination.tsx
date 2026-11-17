import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function pages(current: number, total: number) {
  const set = new Set([1, total, current, current - 1, current + 1].filter((n) => n >= 1 && n <= total));
  const arr = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  arr.forEach((n, i) => {
    if (i && n - arr[i - 1] > 1) out.push("…");
    out.push(n);
  });
  return out;
}

export function Pagination({ page, pageCount, hrefFor }: { page: number; pageCount: number; hrefFor: (p: number) => string }) {
  if (pageCount <= 1) return null;
  const item = "flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-sm font-medium transition";
  return (
    <nav aria-label="Paginación" className="mt-10 flex items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} className={cn(item, "hover:bg-brand-tint")} aria-label="Anterior">
          <ChevronLeft className="h-4 w-4" />
        </Link>
      )}
      {pages(page, pageCount).map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1 text-stone">
            …
          </span>
        ) : (
          <Link key={p} href={hrefFor(p)} aria-current={p === page ? "page" : undefined} className={cn(item, p === page ? "bg-brand text-white shadow-soft" : "hover:bg-brand-tint")}>
            {p}
          </Link>
        ),
      )}
      {page < pageCount && (
        <Link href={hrefFor(page + 1)} className={cn(item, "hover:bg-brand-tint")} aria-label="Siguiente">
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </nav>
  );
}
