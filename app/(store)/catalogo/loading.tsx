import { ProductGridSkeleton, Skeleton } from "@/components/ui/skeleton";

// Esqueleto con la misma estructura que el catálogo (cabecera, categorías, filtros y cuadrícula) para evitar saltos de diseño
export default function Loading() {
  return (
    <div className="container-page py-6 sm:py-10" aria-busy="true">
      <Skeleton className="mb-4 h-3 w-40" />
      <Skeleton className="mb-6 h-40 w-full rounded-3xl sm:mb-8 sm:h-48" />
      <div className="mb-6 flex gap-5 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex w-20 shrink-0 flex-col items-center gap-2">
            <Skeleton className="h-16 w-16 rounded-full sm:h-20 sm:w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
      <div className="flex gap-8 xl:gap-10">
        <Skeleton className="hidden h-[32rem] w-64 shrink-0 rounded-2xl lg:block" />
        <div className="min-w-0 flex-1">
          <Skeleton className="mb-5 h-14 w-full rounded-2xl" />
          <ProductGridSkeleton count={8} />
        </div>
      </div>
    </div>
  );
}
