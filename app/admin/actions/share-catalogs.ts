"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { run, UserError, type ActionResult } from "@/lib/action";
import { assertAdmin } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { newShareToken } from "@/lib/services/share-catalog";
import { shareCatalogSchema, type ShareCatalogInput } from "@/lib/validations/admin";

const PATH = "/admin/catalogo";

export async function saveShareCatalogAction(raw: ShareCatalogInput): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const i = shareCatalogSchema.parse(raw);
    const data = {
      title: i.title,
      message: i.message ?? null,
      // Con productos elegidos las categorías no se usan: se guarda solo un criterio para evitar ambigüedad
      categoryIds: i.productIds.length ? [] : i.categoryIds,
      productIds: i.productIds,
      showPrices: i.showPrices,
      onlyInStock: i.onlyInStock,
      isActive: i.isActive,
      expiresAt: i.expiresAt,
    };
    if (i.id) {
      await prisma.shareCatalog.update({ where: { id: i.id }, data });
    } else {
      await prisma.shareCatalog.create({ data: { ...data, token: newShareToken() } });
    }
    await logAudit(admin.id, i.id ? "UPDATE" : "CREATE", "ShareCatalog", i.id ?? null, { title: i.title });
    revalidatePath(PATH);
    return { ok: true, message: i.id ? "Catálogo actualizado." : "Catálogo creado. Ya puedes compartir el enlace." };
  });
}

export async function toggleShareCatalogAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const c = await prisma.shareCatalog.findUnique({ where: { id }, select: { isActive: true } });
    if (!c) throw new UserError("Catálogo no encontrado.");
    await prisma.shareCatalog.update({ where: { id }, data: { isActive: !c.isActive } });
    await logAudit(admin.id, c.isActive ? "DEACTIVATE" : "ACTIVATE", "ShareCatalog", id);
    revalidatePath(PATH);
    return { ok: true, message: c.isActive ? "Enlace desactivado: los clientes ya no podrán verlo." : "Enlace activado." };
  });
}

/** Cambia el token: el enlace anterior deja de funcionar (útil si se compartió por error). */
export async function regenerateShareLinkAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    await prisma.shareCatalog.update({ where: { id }, data: { token: newShareToken() } });
    await logAudit(admin.id, "REGENERATE_LINK", "ShareCatalog", id);
    revalidatePath(PATH);
    return { ok: true, message: "Enlace renovado. El anterior ya no funciona." };
  });
}

export async function deleteShareCatalogAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    await prisma.shareCatalog.delete({ where: { id } });
    await logAudit(admin.id, "DELETE", "ShareCatalog", id);
    revalidatePath(PATH);
    return { ok: true, message: "Catálogo eliminado." };
  });
}
