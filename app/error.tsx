"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-extrabold">Algo salió mal</h1>
      <p className="max-w-md text-stone">Tuvimos un problema al cargar esta página. Inténtalo nuevamente; si persiste, contáctanos.</p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
