"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useFavorites } from "@/hooks/use-favorites";
import { cn } from "@/lib/utils";

export function FavoriteButton({ productId, name, className }: { productId: string; name: string; className?: string }) {
  const active = useFavorites((s) => s.ids.has(productId));
  const toggle = useFavorites((s) => s.toggle);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setBusy(true);
        await toggle(productId, name);
        setBusy(false);
      }}
      aria-pressed={active}
      aria-label={active ? `Quitar ${name} de favoritos` : `Agregar ${name} a favoritos`}
      className={cn("flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-card backdrop-blur transition hover:scale-110 active:scale-95", className)}
    >
      <Heart className={cn("h-[18px] w-[18px] transition", active ? "fill-brand text-brand" : "text-ink")} />
    </button>
  );
}
