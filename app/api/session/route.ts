import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

// Depende de la cookie de sesión: nunca se cachea ni se comparte
export const dynamic = "force-dynamic";

/** Usuario actual y ids de sus favoritos (para el header y los corazones de la tienda). */
export async function GET() {
  const user = await getCurrentUser();
  const favoriteIds = user ? (await prisma.favorite.findMany({ where: { userId: user.id }, select: { productId: true } })).map((f) => f.productId) : [];
  return NextResponse.json(
    { user: user ? { id: user.id, name: user.name, role: user.role } : null, favoriteIds },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
