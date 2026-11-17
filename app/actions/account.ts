"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { run, UserError, type ActionResult } from "@/lib/action";
import { assertUser } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { addressSchema, type AddressInput } from "@/lib/validations/auth";
import { emailField, nameField } from "@/lib/validations/common";
import { cancelOwnOrder } from "@/lib/services/orders";

// ───────────── Favoritos ─────────────

export async function toggleFavoriteAction(productId: string): Promise<ActionResult<{ favorited: boolean }>> {
  return run<{ favorited: boolean }>(async () => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Inicia sesión para guardar tus favoritos." };
    const pid = z.string().min(1).max(40).parse(productId);
    const existing = await prisma.favorite.findUnique({ where: { userId_productId: { userId: user.id, productId: pid } } });
    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      revalidatePath("/favoritos");
      return { ok: true, data: { favorited: false } };
    }
    const product = await prisma.product.findFirst({ where: { id: pid, status: "ACTIVE" }, select: { id: true } });
    if (!product) throw new UserError("El producto no está disponible.");
    await prisma.favorite.create({ data: { userId: user.id, productId: pid } });
    revalidatePath("/favoritos");
    return { ok: true, data: { favorited: true } };
  });
}

export async function getFavoriteIdsAction(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const rows = await prisma.favorite.findMany({ where: { userId: user.id }, select: { productId: true } });
  return rows.map((r) => r.productId);
}

// ───────────── Direcciones ─────────────

export async function saveAddressAction(raw: AddressInput): Promise<ActionResult> {
  return run(async () => {
    const me = await assertUser();
    const input = addressSchema.parse(raw);
    const count = await prisma.address.count({ where: { userId: me.id } });
    const makeDefault = input.isDefault || count === 0;
    await prisma.$transaction(async (tx) => {
      if (makeDefault) await tx.address.updateMany({ where: { userId: me.id }, data: { isDefault: false } });
      const data = {
        label: input.label, recipient: input.recipient, phone: input.phone, department: input.department,
        province: input.province, district: input.district, line: input.line, reference: input.reference ?? null, isDefault: makeDefault,
      };
      if (input.id) {
        const r = await tx.address.updateMany({ where: { id: input.id, userId: me.id }, data });
        if (r.count === 0) throw new UserError("Dirección no encontrada.");
      } else {
        if (count >= 10) throw new UserError("Puedes guardar hasta 10 direcciones.");
        await tx.address.create({ data: { ...data, userId: me.id } });
      }
    });
    revalidatePath("/mi-cuenta/direcciones");
    return { ok: true, message: "Dirección guardada." };
  });
}

export async function deleteAddressAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const me = await assertUser();
    const r = await prisma.address.deleteMany({ where: { id, userId: me.id } });
    if (r.count === 0) throw new UserError("Dirección no encontrada.");
    const first = await prisma.address.findFirst({ where: { userId: me.id }, orderBy: { createdAt: "asc" } });
    if (first && !(await prisma.address.findFirst({ where: { userId: me.id, isDefault: true } }))) {
      await prisma.address.update({ where: { id: first.id }, data: { isDefault: true } });
    }
    revalidatePath("/mi-cuenta/direcciones");
    return { ok: true, message: "Dirección eliminada." };
  });
}

export async function setDefaultAddressAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const me = await assertUser();
    await prisma.$transaction(async (tx) => {
      const a = await tx.address.findFirst({ where: { id, userId: me.id } });
      if (!a) throw new UserError("Dirección no encontrada.");
      await tx.address.updateMany({ where: { userId: me.id }, data: { isDefault: false } });
      await tx.address.update({ where: { id }, data: { isDefault: true } });
    });
    revalidatePath("/mi-cuenta/direcciones");
    return { ok: true };
  });
}

// ───────────── Pedidos ─────────────

export async function cancelMyOrderAction(orderId: string): Promise<ActionResult> {
  return run(async () => {
    const me = await assertUser();
    await cancelOwnOrder(orderId, me.id);
    revalidatePath("/mi-cuenta/pedidos");
    return { ok: true, message: "Pedido cancelado." };
  });
}

// ───────────── Contacto ─────────────

const contactSchema = z.object({
  name: nameField("Nombre"),
  email: emailField,
  message: z.string().trim().min(10, "Escribe un mensaje de al menos 10 caracteres").max(2000),
});

export async function sendContactMessageAction(raw: z.input<typeof contactSchema>): Promise<ActionResult> {
  return run(async () => {
    const ip = await clientIp();
    if (!(await rateLimit(`contact:${ip}`, 5, 3600))) throw new UserError("Has enviado demasiados mensajes. Inténtalo más tarde.");
    const input = contactSchema.parse(raw);
    await prisma.contactMessage.create({ data: input });
    return { ok: true, message: "¡Mensaje enviado! Te responderemos pronto." };
  });
}
