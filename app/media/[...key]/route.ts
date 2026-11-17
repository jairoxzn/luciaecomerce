import { NextResponse } from "next/server";
import { PUBLIC_FOLDERS, readObject } from "@/lib/storage";

/**
 * Sirve archivos PÚBLICOS (productos, banners, categorías, branding) desde el almacenamiento configurado.
 * Los comprobantes (carpeta "proofs") NO se sirven por aquí: requieren autenticación (/api/proofs/[id]).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  const [folder] = key;
  if (!PUBLIC_FOLDERS.includes(folder) || key.some((p) => p === ".." || p === "." || p.includes("\\"))) {
    return new NextResponse("No encontrado", { status: 404 });
  }
  const file = await readObject(key.join("/"));
  if (!file) return new NextResponse("No encontrado", { status: 404 });
  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable", // nombres con UUID: inmutables
      "X-Content-Type-Options": "nosniff",
    },
  });
}
