"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { run, UserError, type ActionResult } from "@/lib/action";
import { assertAdmin } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { refreshStore } from "@/lib/revalidate";
import { deleteByUrlOrKey } from "@/lib/storage";
import { dec, toCents } from "@/lib/utils";
import { bannerSchema, couponSchema, promotionSchema, type BannerInput, type CouponInput, type PromotionInput } from "@/lib/validations/admin";

// ───────── Cupones ─────────
export async function saveCouponAction(raw: CouponInput): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const i = couponSchema.parse(raw);
    const data = {
      code: i.code, description: i.description ?? null, discountType: i.discountType, value: dec(toCents(i.value)),
      minPurchase: i.minPurchase != null ? dec(toCents(i.minPurchase)) : null, startsAt: i.startsAt, expiresAt: i.expiresAt,
      usageLimit: i.usageLimit ?? null, isPublic: i.isPublic, isActive: i.isActive,
      categories: { set: i.categoryIds.map((id) => ({ id })) },
    };
    if (i.id) await prisma.coupon.update({ where: { id: i.id }, data });
    else await prisma.coupon.create({ data: { ...data, categories: { connect: i.categoryIds.map((id) => ({ id })) } } });
    await logAudit(admin.id, i.id ? "UPDATE" : "CREATE", "Coupon", i.id ?? null, { code: i.code });
    revalidatePath("/admin/cupones");
    return { ok: true, message: "Cupón guardado." };
  });
}

export async function toggleCouponAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const c = await prisma.coupon.findUnique({ where: { id }, select: { isActive: true } });
    if (!c) throw new UserError("Cupón no encontrado.");
    await prisma.coupon.update({ where: { id }, data: { isActive: !c.isActive } });
    await logAudit(admin.id, c.isActive ? "DEACTIVATE" : "ACTIVATE", "Coupon", id);
    revalidatePath("/admin/cupones");
    return { ok: true, message: c.isActive ? "Cupón desactivado." : "Cupón activado." };
  });
}

export async function deleteCouponAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const used = await prisma.order.count({ where: { couponId: id } });
    if (used > 0) throw new UserError("Este cupón ya fue usado en pedidos. Desactívalo en lugar de eliminarlo.");
    await prisma.coupon.delete({ where: { id } });
    await logAudit(admin.id, "DELETE", "Coupon", id);
    revalidatePath("/admin/cupones");
    return { ok: true, message: "Cupón eliminado." };
  });
}

// ───────── Promociones ─────────
export async function savePromotionAction(raw: PromotionInput): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const i = promotionSchema.parse(raw);
    const data = { name: i.name, description: i.description ?? null, discountType: i.discountType, value: dec(toCents(i.value)), categoryId: i.categoryId, startsAt: i.startsAt, endsAt: i.endsAt, isActive: i.isActive };
    if (i.id) await prisma.promotion.update({ where: { id: i.id }, data });
    else await prisma.promotion.create({ data });
    await logAudit(admin.id, i.id ? "UPDATE" : "CREATE", "Promotion", i.id ?? null, { name: i.name });
    refreshStore(); // los precios de la tienda cambian de inmediato
    revalidatePath("/admin/promociones");
    return { ok: true, message: "Promoción guardada." };
  });
}

export async function togglePromotionAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const p = await prisma.promotion.findUnique({ where: { id }, select: { isActive: true } });
    if (!p) throw new UserError("Promoción no encontrada.");
    await prisma.promotion.update({ where: { id }, data: { isActive: !p.isActive } });
    await logAudit(admin.id, p.isActive ? "DEACTIVATE" : "ACTIVATE", "Promotion", id);
    refreshStore();
    revalidatePath("/admin/promociones");
    return { ok: true, message: p.isActive ? "Promoción desactivada." : "Promoción activada." };
  });
}

export async function deletePromotionAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    await prisma.promotion.delete({ where: { id } });
    await logAudit(admin.id, "DELETE", "Promotion", id);
    refreshStore();
    revalidatePath("/admin/promociones");
    return { ok: true, message: "Promoción eliminada." };
  });
}

// ───────── Banners ─────────
export async function saveBannerAction(raw: BannerInput): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const i = bannerSchema.parse(raw);
    const data = { title: i.title, subtitle: i.subtitle ?? null, ctaLabel: i.ctaLabel ?? null, ctaHref: i.ctaHref, imageUrl: i.imageUrl, mobileImageUrl: i.mobileImageUrl, position: i.position, sortOrder: i.sortOrder, isActive: i.isActive, startsAt: i.startsAt, endsAt: i.endsAt };
    if (i.id) {
      const prev = await prisma.banner.findUnique({ where: { id: i.id }, select: { imageUrl: true, mobileImageUrl: true } });
      await prisma.banner.update({ where: { id: i.id }, data });
      if (prev?.imageUrl && prev.imageUrl !== i.imageUrl) await deleteByUrlOrKey(prev.imageUrl);
      if (prev?.mobileImageUrl && prev.mobileImageUrl !== i.mobileImageUrl) await deleteByUrlOrKey(prev.mobileImageUrl);
    } else {
      await prisma.banner.create({ data });
    }
    await logAudit(admin.id, i.id ? "UPDATE" : "CREATE", "Banner", i.id ?? null, { title: i.title });
    refreshStore();
    revalidatePath("/admin/banners");
    return { ok: true, message: "Banner guardado." };
  });
}

export async function deleteBannerAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const b = await prisma.banner.delete({ where: { id } });
    await deleteByUrlOrKey(b.imageUrl);
    await deleteByUrlOrKey(b.mobileImageUrl);
    await logAudit(admin.id, "DELETE", "Banner", id);
    refreshStore();
    revalidatePath("/admin/banners");
    return { ok: true, message: "Banner eliminado." };
  });
}
