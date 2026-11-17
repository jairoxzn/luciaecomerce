import { NextResponse } from "next/server";
import { searchSuggestions } from "@/lib/services/catalog";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ items: [] });
  if (!(await rateLimit(`search:${await clientIp()}`, 60, 60))) return NextResponse.json({ items: [] }, { status: 429 });
  const items = await searchSuggestions(q);
  return NextResponse.json({ items: items.map((i) => ({ slug: i.slug, name: i.name, image: i.image, price: i.price, compareAt: i.compareAt, category: i.categoryName })) });
}
