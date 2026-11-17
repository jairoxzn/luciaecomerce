"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { run, UserError, type ActionResult } from "@/lib/action";
import { assertAdmin } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { refreshStore } from "@/lib/revalidate";
import { deleteByUrlOrKey } from "@/lib/storage";
import { dec, toCents } from "@/lib/utils";
import { settingsSchema, shippingZoneSchema, type SettingsInput, type ShippingZoneInput } from "@/lib/validations/admin";

export async function saveSettingsAction(raw: SettingsInput): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const i = settingsSchema.parse(raw);
    // Un método de pago no puede activarse sin sus datos mínimos (evita checkout roto)
    if (i.yapeEnabled && !i.yapeNumber) throw new UserError("Para activar Yape ingresa el número.");
    if (i.plinEnabled && !i.plinNumber) throw new UserError("Para activar Plin ingresa el número.");
    if (i.transferEnabled && !i.bankAccountNumber) throw new UserError("Para activar transferencias ingresa el número de cuenta.");
    const prev = await prisma.storeSettings.findUnique({ where: { id: "main" }, select: { logoUrl: true, yapeQrUrl: true, plinQrUrl: true } });
    const { sizeGuide, pickupPrice, ...rest } = i;
    const data = { ...rest, pickupPrice: dec(toCents(pickupPrice)), sizeGuide: sizeGuide as unknown as Prisma.InputJsonValue };
    await prisma.storeSettings.upsert({ where: { id: "main" }, update: data, create: { id: "main", ...data } });
    for (const k of ["logoUrl", "yapeQrUrl", "plinQrUrl"] as const) {
      if (prev?.[k] && prev[k] !== i[k]) await deleteByUrlOrKey(prev[k]);
    }
    await logAudit(admin.id, "UPDATE", "StoreSettings", "main", { yape: i.yapeEnabled, plin: i.plinEnabled, transfer: i.transferEnabled, cod: i.codEnabled });
    refreshStore();
    revalidatePath("/admin/configuracion");
    return { ok: true, message: "Configuración guardada." };
  });
}

export async function saveZoneAction(raw: ShippingZoneInput): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const i = shippingZoneSchema.parse(raw);
    const data = { name: i.name, departments: i.departments, price: dec(toCents(i.price)), freeShippingFrom: i.freeShippingFrom != null ? dec(toCents(i.freeShippingFrom)) : null, estimatedDays: i.estimatedDays ?? null, isActive: i.isActive, sortOrder: i.sortOrder };
    // Un departamento no debe pertenecer a dos zonas activas
    const others = await prisma.shippingZone.findMany({ where: { isActive: true, ...(i.id ? { id: { not: i.id } } : {}) } });
    const clash = i.isActive ? i.departments.find((d) => others.some((z) => z.departments.includes(d))) : undefined;
    if (clash) throw new UserError(`"${clash}" ya está en otra zona activa.`);
    if (i.id) await prisma.shippingZone.update({ where: { id: i.id }, data });
    else await prisma.shippingZone.create({ data });
    await logAudit(admin.id, i.id ? "UPDATE" : "CREATE", "ShippingZone", i.id ?? null, { name: i.name });
    refreshStore();
    revalidatePath("/admin/configuracion");
    return { ok: true, message: "Zona de entrega guardada." };
  });
}

export async function deleteZoneAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    await prisma.shippingZone.delete({ where: { id } });
    await logAudit(admin.id, "DELETE", "ShippingZone", id);
    refreshStore();
    revalidatePath("/admin/configuracion");
    return { ok: true, message: "Zona eliminada." };
  });
}
