"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BannerData } from "@/lib/services/catalog";

/** Título "Moda para todos. Viste tu estilo, siempre." → script + negrita con última palabra en rosa */
function HeroTitle({ title, primary }: { title: string; primary: boolean }) {
  const parts = title.split(/\.\s+/).filter(Boolean);
  const Tag = primary ? "h1" : "h2";
  if (parts.length < 2) {
    const words = title.trim().split(" ");
    const last = words.pop();
    return (
      <Tag className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
        {words.join(" ")} <span className="text-brand">{last}</span>
      </Tag>
    );
  }
  const [first, ...rest] = parts;
  const restText = rest.join(". ").replace(/\.$/, "");
  const words = restText.split(" ");
  const last = words.pop();
  return (
    <Tag>
      <span className="block font-script text-3xl font-semibold text-ink sm:text-4xl lg:text-5xl">{first}</span>
      <span className="mt-1 block text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
        {words.join(" ")} <span className="text-brand">{last}</span>
      </span>
    </Tag>
  );
}

export function HeroCarousel({ banners, description }: { banners: BannerData[]; description: string }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = banners.length;
  const go = useCallback((d: number) => setI((x) => (x + d + n) % n), [n]);

  useEffect(() => {
    if (n < 2 || paused) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 6500);
    return () => clearInterval(t);
  }, [n, paused]);

  if (n === 0) return null;

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Destacados"
      className="relative overflow-hidden bg-gradient-to-br from-brand-tint via-white to-brand-soft/40"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-soft/40 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-brand/15 blur-3xl" aria-hidden />

      <div className="container-page relative">
        {banners.map((b, idx) => {
          const active = idx === i;
          return (
            <div
              key={b.id}
              aria-hidden={!active}
              className={cn(
                "grid items-center gap-6 py-8 transition-opacity duration-700 lg:grid-cols-2 lg:gap-10 lg:py-14",
                active ? "relative opacity-100" : "pointer-events-none absolute inset-x-4 top-0 opacity-0 sm:inset-x-6 lg:inset-x-8",
              )}
            >
              <div className="order-2 lg:order-1">
                <HeroTitle title={b.title} primary={idx === 0} />
                <p className="mt-4 max-w-md text-base text-stone sm:text-lg">{b.subtitle ?? (idx === 0 ? description : "")}</p>
                {b.ctaLabel && b.ctaHref && (
                  <Link
                    href={b.ctaHref}
                    tabIndex={active ? 0 : -1}
                    className="group mt-7 inline-flex h-13 items-center gap-2 rounded-full bg-brand px-8 py-3.5 text-base font-semibold text-white shadow-soft transition hover:bg-brand-dark hover:shadow-xl active:scale-[0.97]"
                  >
                    {b.ctaLabel}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </Link>
                )}
              </div>
              <div className="order-1 lg:order-2">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-brand-tint shadow-soft lg:aspect-[16/12]">
                  <Image
                    src={b.imageUrl}
                    alt={b.title}
                    fill
                    priority={idx === 0}
                    sizes="(min-width:1024px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          );
        })}

        {n > 1 && (
          <div className="relative z-10 flex items-center justify-center gap-3 pb-5">
            <button onClick={() => go(-1)} className="rounded-full bg-white p-2 shadow-card transition hover:text-brand" aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></button>
            <div className="flex gap-2">
              {banners.map((b, idx) => (
                <button key={b.id} onClick={() => setI(idx)} aria-label={`Ir al banner ${idx + 1}`} aria-current={idx === i} className={cn("h-2 rounded-full transition-all", idx === i ? "w-8 bg-brand" : "w-2 bg-brand-soft hover:bg-brand")} />
              ))}
            </div>
            <button onClick={() => go(1)} className="rounded-full bg-white p-2 shadow-card transition hover:text-brand" aria-label="Siguiente"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </section>
  );
}
