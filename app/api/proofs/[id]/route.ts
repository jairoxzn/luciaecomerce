import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccessibleOrderId } from "@/lib/auth/order-access";
import { readObject } from "@/lib/storage";

/** Comprobantes (privados): solo el administrador o el dueño del pedido. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const proof = await prisma.paymentProof.findUnique({ where: { id }, include: { payment: { include: { order: { select: { code: true } } } } } });
  if (!proof || !(await getAccessibleOrderId(proof.payment.order.code))) return new NextResponse("No encontrado", { status: 404 });
  const file = await readObject(proof.fileKey);
  if (!file) return new NextResponse("No encontrado", { status: 404 });
  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "Content-Type": proof.mimeType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="comprobante-${proof.id}"`,
    },
  });
}
