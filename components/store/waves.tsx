/** Ondas rosadas decorativas (solo ornamento: aria-hidden y sin interacción). */

/** Esquinas del héroe: onda fuerte arriba a la izquierda y ondas suaves abajo. */
export function HeroWaves() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="absolute -left-6 -top-4 h-40 w-64 text-brand sm:h-52 sm:w-80" viewBox="0 0 320 210" fill="none">
        <path d="M0 0H320C270 34 238 80 160 96 96 109 40 140 0 210Z" fill="currentColor" opacity=".95" />
        <path d="M0 0H220C180 26 150 62 90 74 50 82 20 110 0 150Z" fill="#fff" opacity=".22" />
      </svg>
      <svg className="absolute -bottom-6 -left-10 h-44 w-72 text-brand-soft sm:h-56 sm:w-96" viewBox="0 0 380 220" fill="none">
        <path d="M0 220V70C60 60 100 110 170 120 240 130 300 190 380 220Z" fill="currentColor" opacity=".75" />
        <path d="M0 220V130C50 120 90 160 150 170 210 180 260 205 300 220Z" fill="#fff" opacity=".35" />
      </svg>
      <svg className="absolute -bottom-6 -right-10 h-40 w-72 text-brand sm:h-52 sm:w-96" viewBox="0 0 380 210" fill="none">
        <path d="M380 210V40C330 30 290 80 220 96 150 112 80 170 0 210Z" fill="currentColor" opacity=".9" />
        <path d="M380 210V110C340 104 305 140 250 156 200 170 150 195 110 210Z" fill="#fff" opacity=".28" />
      </svg>
    </div>
  );
}

/** Borde ondulado rosa-negro sobre el pie de página. */
export function FooterWave() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-x-0 -top-7 h-8 w-full" viewBox="0 0 1440 32" preserveAspectRatio="none" fill="none">
      <path d="M0 32V14C160 -2 300 -2 480 12S820 30 1000 14 1300 -2 1440 10V32Z" className="text-brand" fill="currentColor" />
      <path d="M0 32V22C180 8 320 8 500 20S840 34 1020 20 1320 6 1440 18V32Z" className="text-ink" fill="currentColor" />
    </svg>
  );
}
