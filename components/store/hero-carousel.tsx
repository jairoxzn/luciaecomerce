"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BannerData } from "@/lib/services/catalog";
import { HeroWaves } from "./waves";

/**
 * "Moda que te inspira. Viste tu estilo" →
 *   kicker (letra manuscrita, a la izquierda de la foto): «Moda que te inspira»
 *   titular: «VISTE TU» en negrita + «Estilo» manuscrito rosa grande con subrayado.
 * Sin punto, todo el texto es el titular.
 */
function splitTitle(title: string) {
  const parts = title.split(/\.\s+/).filter(Boolean);
  const kicker = parts.length > 1 ? parts[0] : null;
  const main = (parts.length > 1 ? parts.slice(1).join(". ") : title).replace(/\.$/, "").trim();
  const words = main.split(/\s+/);
  const last = words.length > 1 ? words.pop()! : null;
  return { kicker, lead: words.join(" "), last };
}

function Headline({ title, primary }: { title: string; primary: boolean }) {
  const { lead, last } = splitTitle(title);
  const Tag = primary ? "h1" : "h2";
  return (
    <Tag className="leading-none">
      <span className="block text-[2.6rem] font-extrabold uppercase tracking-tight text-ink sm:text-6xl lg:text-[4.2rem]">{last ? lead : title}</span>
      {last && (
        <span className="relative mx-auto mt-1 block w-fit lg:mx-0">
          <span className="block -skew-x-6 text-[3.9rem] font-black uppercase italic leading-[0.95] tracking-tight text-brand sm:text-[5.6rem] lg:text-[6.6rem]">{last}</span>
          <svg aria-hidden viewBox="0 0 300 18" className="absolute -bottom-2 left-2 h-3 w-[90%] text-brand" fill="none">
            <path d="M3 13C70 4 180 3 297 8" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
          </svg>
        </span>
      )}
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
      className="relative overflow-hidden bg-gradient-to-r from-white via-[#fdeff4] to-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <HeroWaves />

      <div className="relative mx-auto max-w-[90rem] px-4 sm:px-14">
        {banners.map((b, idx) => {
          const active = idx === i;
          const { kicker } = splitTitle(b.title);
          return (
            <div
              key={b.id}
              aria-hidden={!active}
              className={cn(
                "grid items-center gap-2 pb-10 pt-6 transition-opacity duration-700 lg:grid-cols-[0.8fr_1fr_1.2fr] lg:gap-6 lg:pb-12 lg:pt-8",
                active ? "relative opacity-100" : "pointer-events-none absolute inset-x-4 top-0 opacity-0 sm:inset-x-14",
              )}
            >
              {/* Frase manuscrita (solo escritorio, a la izquierda de la foto) */}
              <div className="order-2 hidden self-center lg:order-1 lg:block lg:pl-4">
                {kicker && (
                  <div className="-rotate-3">
                    <p className="max-w-[9rem] font-script text-4xl font-semibold leading-[1.05] text-ink xl:text-5xl">{kicker}</p>
                    <Heart className="ml-10 mt-3 h-9 w-9 text-brand" strokeWidth={1.6} aria-hidden />
                  </div>
                )}
              </div>

              {/* Foto */}
              <div className="order-1 mx-auto w-full max-w-[22rem] lg:order-2 lg:max-w-none">
                <div className="relative aspect-[4/4.6] [mask-image:linear-gradient(to_right,transparent,#000_16%,#000_84%,transparent),linear-gradient(to_top,transparent,#000_10%),linear-gradient(to_bottom,transparent,#000_9%)] [mask-composite:intersect] lg:aspect-[4/4.4]">
                  <Image
                    src={b.imageUrl}
                    alt={b.title}
                    fill
                    priority={idx === 0}
                    sizes="(min-width:1024px) 34vw, 90vw"
                    className="object-cover object-top"
                  />
                </div>
              </div>

              {/* Titular, subtítulo y botón */}
              <div className="order-3 text-center lg:text-left">
                <Headline title={b.title} primary={idx === 0} />
                <p className="mx-auto mt-4 max-w-md text-sm text-ink/85 sm:text-base lg:mx-0">{b.subtitle ?? (idx === 0 ? description : "")}</p>
                {b.ctaLabel && b.ctaHref && (
                  <Link
                    href={b.ctaHref}
                    tabIndex={active ? 0 : -1}
                    className="group mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-soft transition hover:bg-brand-dark hover:shadow-xl active:scale-[0.97] sm:text-base"
                  >
                    {b.ctaLabel}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}

        {n > 1 && (
          <>
            <button onClick={() => go(-1)} className="absolute left-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-card transition hover:text-brand sm:flex lg:left-5" aria-label="Anterior"><ChevronLeft className="h-5 w-5" /></button>
            <button onClick={() => go(1)} className="absolute right-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-card transition hover:text-brand sm:flex lg:right-5" aria-label="Siguiente"><ChevronRight className="h-5 w-5" /></button>
            <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-2">
              {banners.map((b, idx) => (
                <button key={b.id} onClick={() => setI(idx)} aria-label={`Ir al banner ${idx + 1}`} aria-current={idx === i} className={cn("h-2.5 rounded-full transition-all", idx === i ? "w-6 bg-brand" : "w-2.5 bg-brand-soft hover:bg-brand")} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
