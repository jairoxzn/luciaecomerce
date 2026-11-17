import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/csrf";
import { getAccessibleOrderId } from "@/lib/auth/order-access";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { submitPaymentProof } from "@/lib/services/payments";
import { UserError, toFail } from "@/lib/action";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Solicitud no permitida." }, { status: 403 });
  const { code } = await ctx.params;
  try {
    if (!(await rateLimit(`proof:${await clientIp()}`, 10, 3600))) throw new UserError("Demasiados envíos. Inténtalo más tarde.");
    const orderId = await getAccessibleOrderId(code);
    if (!orderId) return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Selecciona el archivo del comprobante.");
    const op = String(form.get("operationNumber") ?? "").trim().slice(0, 40);
    await submitPaymentProof({ orderId, file, operationNumber: op || null });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const r = toFail(e);
    return NextResponse.json(r, { status: 400 });
  }
}
