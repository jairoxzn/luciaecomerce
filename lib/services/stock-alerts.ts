import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/action";
import { sendMail, mailerConfigured } from "@/lib/mailer";
import { getSettings } from "@/lib/services/settings";
import { absoluteUrl, normalizePeruPhone } from "@/lib/utils";
import { sendWhatsAppText, whatsappEnvConfigured } from "@/lib/whatsapp";

/** Máximo de avisos que se envían por pasada (protege el servidor si una variante tenía mucha demanda). */
const BATCH = 200;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Registra a un cliente en la lista de espera de una variante agotada. Es idempotente: si ya estaba esperando
 * no duplica; si ya había sido avisado, vuelve a quedar en espera (pidió el aviso otra vez).
 */
export async function subscribeStockAlert(opts: { variantId: string; email?: string | null; phone?: string | null; userId?: string | null }) {
  const email = opts.email?.trim().toLowerCase() || null;
  const phone = opts.phone?.trim() || null;
  if (!email && !phone) throw new UserError("Déjanos tu correo o tu celular para avisarte.");

  const v = await prisma.productVariant.findUnique({ where: { id: opts.variantId }, select: { id: true, stock: true, isActive: true, product: { select: { status: true } } } });
  if (!v || !v.isActive || v.product.status !== "ACTIVE") throw new UserError("Este producto ya no está disponible.");
  if (v.stock > 0) throw new UserError("¡Esta talla ya tiene stock! Puedes agregarla al carrito.");

  // Con valores nulos no se puede usar upsert sobre el índice único compuesto: se busca y se crea o se reactiva
  const existing = await prisma.stockAlert.findFirst({ where: { variantId: v.id, OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] } });
  if (existing) {
    await prisma.stockAlert.update({ where: { id: existing.id }, data: { notifiedAt: null, email: email ?? existing.email, phone: phone ?? existing.phone } });
    return { created: false };
  }
  await prisma.stockAlert.create({ data: { variantId: v.id, email, phone, userId: opts.userId ?? null } });
  return { created: true };
}

type Claimed = {
  id: string;
  email: string | null;
  phone: string | null;
  variant: { stock: number; size: { name: string }; color: { name: string }; product: { name: string; slug: string } };
};

/**
 * Avisa a quienes esperaban una variante que ya tiene stock. Se ejecuta tras cualquier cambio de inventario.
 *  - Correo (si hay SMTP) y WhatsApp (solo si la integración está activa); nunca se simula un envío.
 *  - Si no hay forma automática de avisar, la espera sigue abierta y el panel muestra el enlace manual de WhatsApp.
 *  - Cada aviso se «reclama» con un UPDATE condicional antes de enviarse, así dos ejecuciones simultáneas no duplican correos.
 */
export async function processStockAlerts(): Promise<{ notified: number; pending: number }> {
  const waiting = await prisma.stockAlert.findMany({
    where: { notifiedAt: null, variant: { stock: { gt: 0 }, isActive: true, product: { status: "ACTIVE" } } },
    orderBy: { createdAt: "asc" },
    take: BATCH,
    select: { id: true, email: true, phone: true, variant: { select: { stock: true, size: { select: { name: true } }, color: { select: { name: true } }, product: { select: { name: true, slug: true } } } } },
  });
  if (waiting.length === 0) return { notified: 0, pending: 0 };

  const settings = await getSettings();
  const waEnabled = settings.whatsappNotificationsEnabled && whatsappEnvConfigured();
  let notified = 0;
  let pending = 0;

  for (const a of waiting as Claimed[]) {
    const canMail = !!a.email && mailerConfigured();
    const canWa = !!a.phone && waEnabled;
    if (!canMail && !canWa) {
      pending++;
      continue;
    }
    const claim = await prisma.stockAlert.updateMany({ where: { id: a.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
    if (claim.count === 0) continue; // otra ejecución ya lo tomó

    const name = a.variant.product.name;
    const detail = `${a.variant.color.name} / talla ${a.variant.size.name}`;
    const url = absoluteUrl(`/productos/${a.variant.product.slug}`);
    let ok = false;

    if (canMail) {
      const r = await sendMail({
        to: a.email!,
        subject: `¡Ya llegó! ${name} vuelve a estar disponible`,
        text: `Hola, el producto que esperabas ya tiene stock en ${settings.storeName}.\n\n${name} (${detail})\n${url}\n\nSon pocas unidades: te recomendamos comprarlo pronto.`,
        html: `<p>Hola,</p><p>El producto que esperabas ya tiene stock en <strong>${esc(settings.storeName)}</strong>:</p><p><strong>${esc(name)}</strong><br>${esc(detail)}</p><p><a href="${url}" style="background:#e65385;color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:bold">Ver producto</a></p><p style="color:#737373;font-size:12px">Son pocas unidades: te recomendamos comprarlo pronto.</p>`,
      });
      ok = ok || r.ok;
    }
    if (canWa) {
      const r = await sendWhatsAppText(normalizePeruPhone(a.phone!), `¡Ya llegó! ${name} (${detail}) vuelve a estar disponible en ${settings.storeName}: ${url}`);
      ok = ok || r.ok;
    }
    if (ok) notified++;
    else {
      await prisma.stockAlert.updateMany({ where: { id: a.id }, data: { notifiedAt: null } }); // falló todo: reintentar en la próxima pasada
      pending++;
    }
  }
  return { notified, pending };
}

/** Ejecuta `processStockAlerts` después de responder (sin retrasar la acción del administrador ni del cliente). */
export function scheduleStockAlerts() {
  const run = () => processStockAlerts().catch((e) => console.error("[stock-alerts] fallo al avisar", e));
  try {
    after(run);
  } catch {
    void run(); // fuera de una petición de Next (p. ej. scripts o pruebas)
  }
}

/** Demanda en espera por variante (lo que más se pide y no hay): guía para reponer. */
export async function getRestockDemand(take = 10) {
  const groups = await prisma.stockAlert.groupBy({ by: ["variantId"], where: { notifiedAt: null }, _count: { _all: true }, orderBy: { _count: { variantId: "desc" } }, take });
  if (groups.length === 0) return [];
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: groups.map((g) => g.variantId) } },
    select: { id: true, stock: true, product: { select: { id: true, name: true } }, size: { select: { name: true } }, color: { select: { name: true, hex: true } } },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  return groups
    .map((g) => {
      const v = byId.get(g.variantId);
      return v ? { variantId: v.id, productId: v.product.id, product: v.product.name, size: v.size.name, color: v.color.name, hex: v.color.hex, stock: v.stock, waiting: g._count._all } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
}
