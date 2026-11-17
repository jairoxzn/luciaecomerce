"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, name, index, onIndex }: { images: { id: string; url: string; alt: string | null }[]; name: string; index: number; onIndex: (i: number) => void }) {
  const [zoom, setZoom] = useState(false);
  const n = images.length;
  const go = (d: number) => onIndex((index + d + n) % n);

  useEffect(() => {
    if (!zoom) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, index, n]);

  if (n === 0) return <div className="flex aspect-[3/4] items-center justify-center rounded-3xl bg-mist text-stone">Sin imágenes</div>;
  const current = images[index] ?? images[0];

  return (
    <div className="flex gap-3">
      {n > 1 && (
        <ul className="hidden w-20 shrink-0 flex-col gap-3 sm:flex">
          {images.map((im, i) => (
            <li key={im.id}>
              <button onClick={() => onIndex(i)} aria-label={`Ver imagen ${i + 1}`} aria-current={i === index} className={cn("relative block aspect-[3/4] w-full overflow-hidden rounded-xl bg-brand-tint/50 ring-2 ring-transparent transition", i === index ? "ring-brand" : "opacity-70 hover:opacity-100")}>
                <Image src={im.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="min-w-0 flex-1">
        <div className="group relative aspect-[3/4] overflow-hidden rounded-3xl bg-brand-tint/40">
          <Image key={current.id} src={current.url} alt={current.alt ?? name} fill priority sizes="(min-width:1024px) 50vw, 100vw" className="animate-[fade-up_0.4s_ease-out] object-cover" />
          <button onClick={() => setZoom(true)} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-card backdrop-blur transition hover:scale-110" aria-label="Ampliar imagen">
            <Expand className="h-4 w-4" />
          </button>
          {n > 1 && (
            <>
              <button onClick={() => go(-1)} className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 opacity-100 shadow-card transition sm:opacity-0 sm:group-hover:opacity-100" aria-label="Imagen anterior"><ChevronLeft className="h-5 w-5" /></button>
              <button onClick={() => go(1)} className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 opacity-100 shadow-card transition sm:opacity-0 sm:group-hover:opacity-100" aria-label="Imagen siguiente"><ChevronRight className="h-5 w-5" /></button>
            </>
          )}
        </div>
        {n > 1 && (
          <div className="mt-3 flex justify-center gap-1.5 sm:hidden">
            {images.map((im, i) => (
              <button key={im.id} onClick={() => onIndex(i)} aria-label={`Imagen ${i + 1}`} className={cn("h-2 rounded-full transition-all", i === index ? "w-6 bg-brand" : "w-2 bg-brand-soft")} />
            ))}
          </div>
        )}
      </div>

      {zoom && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/95 p-4" role="dialog" aria-modal="true" aria-label="Imagen ampliada" onClick={() => setZoom(false)}>
          <button className="absolute right-4 top-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Cerrar" onClick={() => setZoom(false)}><X className="h-5 w-5" /></button>
          {n > 1 && (
            <>
              <button className="absolute left-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Anterior" onClick={(e) => { e.stopPropagation(); go(-1); }}><ChevronLeft className="h-6 w-6" /></button>
              <button className="absolute right-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Siguiente" onClick={(e) => { e.stopPropagation(); go(1); }}><ChevronRight className="h-6 w-6" /></button>
            </>
          )}
          <div className="relative h-full max-h-[90dvh] w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <Image src={current.url} alt={current.alt ?? name} fill sizes="90vw" quality={90} className="object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
