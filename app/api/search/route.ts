import { NextResponse } from "next/server";
import { searchSuggestions } from "@/lib/services/catalog";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Resultados públicos e iguales para todos: el navegador y la CDN pueden reutilizarlos unos segundos
const CACHE = "public, max-age=30, s-maxage=60, stale-while-revalidate=120";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ items: [] }, { headers: { "Cache-Control": CACHE } });
  // Vía rápida (Redis): el autocompletado se dispara en cada pausa de escritura
  if (!(await rateLimit(`search:${await clientIp()}`, 60, 60, { fast: true }))) return NextResponse.json({ items: [] }, { status: 429 });
  const items = await searchSuggestions(q);
  return NextResponse.json(
    { items: items.map((i) => ({ slug: i.slug, name: i.name, image: i.image, price: i.price, compareAt: i.compareAt, category: i.categoryName })) },
    { headers: { "Cache-Control": CACHE } },
  );
}
