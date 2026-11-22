"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { run, UserError, type ActionResult } from "@/lib/action";
import { assertAdmin } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { refreshStore } from "@/lib/revalidate";
import { deleteByUrlOrKey } from "@/lib/storage";
import { dec, slugify, toCents } from "@/lib/utils";
import { applyStockDelta, setStockExact } from "@/lib/services/inventory";
import { scheduleStockAlerts } from "@/lib/services/stock-alerts";
import { generateVariantsSchema, productSchema, variantUpdateSchema, type GenerateVariantsInput, type ProductInput, type VariantUpdateInput } from "@/lib/validations/admin";

async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base) || "producto";
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    const found = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!found || found.id === excludeId) return slug;
  }
  return `${root}-${randomBytes(3).toString("hex")}`;
}

function productData(i: ReturnType<typeof productSchema.parse>) {
  return {
    name: i.name,
    description: i.description,
    material: i.material ?? null,
    careInstructions: i.careInstructions ?? null,
    category: { connect: { id: i.categoryId } },
    price: dec(toCents(i.price)),
    salePrice: i.salePrice != null ? dec(toCents(i.salePrice)) : null,
    status: i.status,
    isFeatured: i.isFeatured,
    isBestSeller: i.isBestSeller,
    isNew: i.isNew,
  };
}

async function validateSubcategory(categoryId: string, subcategoryId: string | null) {
  if (!subcategoryId) return;
  const s = await prisma.subcategory.findFirst({ where: { id: subcategoryId, categoryId }, select: { id: true } });
  if (!s) throw new UserError("La subcategoría no pertenece a la categoría seleccionada.");
}

export async function createProductAction(raw: ProductInput): Promise<ActionResult<{ id: string }>> {
  return run<{ id: string }>(async () => {
    const admin = await assertAdmin();
    const i = productSchema.parse(raw);
    await validateSubcategory(i.categoryId, i.subcategoryId);
    const sku = i.sku ?? `LJ-${randomBytes(3).toString("hex").toUpperCase()}`;
    const p = await prisma.product.create({
      data: { ...productData(i), sku, slug: await uniqueSlug(i.name), subcategory: i.subcategoryId ? { connect: { id: i.subcategoryId } } : undefined },
    });
    await logAudit(admin.id, "CREATE", "Product", p.id, { name: p.name });
    refreshStore();
    revalidatePath("/admin/productos");
    return { ok: true, data: { id: p.id }, message: "Producto creado. Ahora agrega fotos y variantes." };
  });
}

export async function updateProductAction(id: string, raw: ProductInput): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const i = productSchema.parse(raw);
    await validateSubcategory(i.categoryId, i.subcategoryId);
    const current = await prisma.product.findUnique({ where: { id }, select: { name: true, slug: true, price: true, salePrice: true } });
    if (!current) throw new UserError("Producto no encontrado.");
    // Nota: el slug se conserva para no romper URLs ya indexadas
    await prisma.product.update({
      where: { id },
      data: { ...productData(i), ...(i.sku ? { sku: i.sku } : {}), subcategory: i.subcategoryId ? { connect: { id: i.subcategoryId } } : { disconnect: true } },
    });
    await logAudit(admin.id, "UPDATE", "Product", id, { name: i.name, price: i.price, salePrice: i.salePrice ?? null });
    refreshStore();
    revalidatePath("/admin/productos");
    return { ok: true, message: "Producto actualizado." };
  });
}

export async function setProductStatusAction(id: string, status: "DRAFT" | "ACTIVE" | "ARCHIVED"): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    await prisma.product.update({ where: { id }, data: { status } });
    await logAudit(admin.id, `STATUS_${status}`, "Product", id);
    refreshStore();
    revalidatePath("/admin/productos");
    return { ok: true, message: status === "ARCHIVED" ? "Producto archivado." : status === "ACTIVE" ? "Producto publicado." : "Producto en borrador." };
  });
}

/** Elimina definitivamente solo si nunca se vendió; de lo contrario se debe archivar. */
export async function deleteProductAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const sold = await prisma.orderItem.count({ where: { productId: id } });
    if (sold > 0) throw new UserError("Este producto ya tiene ventas registradas. Archívalo en lugar de eliminarlo.");
    const images = await prisma.productImage.findMany({ where: { productId: id }, select: { url: true } });
    await prisma.product.delete({ where: { id } });
    await Promise.all(images.map((im) => deleteByUrlOrKey(im.url)));
    await logAudit(admin.id, "DELETE", "Product", id);
    refreshStore();
    revalidatePath("/admin/productos");
    return { ok: true, message: "Producto eliminado." };
  });
}

export async function deleteDemoProductsAction(): Promise<ActionResult<{ deleted: number; archived: number }>> {
  return run<{ deleted: number; archived: number }>(async () => {
    const admin = await assertAdmin();
    const demos = await prisma.product.findMany({ where: { isDemo: true }, select: { id: true } });
    let deleted = 0;
    let archived = 0;
    for (const d of demos) {
      const sold = await prisma.orderItem.count({ where: { productId: d.id } });
      if (sold > 0) {
        await prisma.product.update({ where: { id: d.id }, data: { status: "ARCHIVED" } });
        archived++;
      } else {
        await prisma.product.delete({ where: { id: d.id } });
        deleted++;
      }
    }
    await logAudit(admin.id, "DELETE_DEMO", "Product", null, { deleted, archived });
    refreshStore();
    revalidatePath("/admin/productos");
    return { ok: true, data: { deleted, archived }, message: `Productos demo eliminados: ${deleted}. Archivados (con ventas): ${archived}.` };
  });
}

// ───────────── Imágenes ─────────────

export async function addProductImagesAction(productId: string, urls: string[]): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const clean = urls.filter((u) => typeof u === "string" && (u.startsWith("/media/products/") || /^https:\/\//.test(u))).slice(0, 12);
    if (!clean.length) throw new UserError("No hay imágenes válidas.");
    const last = await prisma.productImage.findFirst({ where: { productId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { name: true } });
    if (!product) throw new UserError("Producto no encontrado.");
    await prisma.productImage.createMany({ data: clean.map((url, i) => ({ productId, url, alt: product.name, sortOrder: (last?.sortOrder ?? -1) + 1 + i })) });
    await logAudit(admin.id, "ADD_IMAGES", "Product", productId, { count: clean.length });
    refreshStore();
    revalidatePath(`/admin/productos/${productId}`);
    return { ok: true, message: "Imágenes agregadas." };
  });
}

export async function removeProductImageAction(imageId: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const img = await prisma.productImage.findUnique({ where: { id: imageId } });
    if (!img) throw new UserError("Imagen no encontrada.");
    await prisma.productImage.delete({ where: { id: imageId } });
    const stillUsed = await prisma.productImage.count({ where: { url: img.url } });
    if (!stillUsed) await deleteByUrlOrKey(img.url);
    await logAudit(admin.id, "REMOVE_IMAGE", "Product", img.productId);
    refreshStore();
    revalidatePath(`/admin/productos/${img.productId}`);
    return { ok: true, message: "Imagen eliminada." };
  });
}

export async function reorderProductImagesAction(productId: string, orderedIds: string[]): Promise<ActionResult> {
  return run(async () => {
    await assertAdmin();
    await prisma.$transaction(orderedIds.map((id, i) => prisma.productImage.updateMany({ where: { id, productId }, data: { sortOrder: i } })));
    refreshStore();
    revalidatePath(`/admin/productos/${productId}`);
    return { ok: true };
  });
}

export async function setImageColorAction(imageId: string, colorId: string | null): Promise<ActionResult> {
  return run(async () => {
    await assertAdmin();
    const img = await prisma.productImage.update({ where: { id: imageId }, data: { colorId: colorId || null } });
    refreshStore();
    revalidatePath(`/admin/productos/${img.productId}`);
    return { ok: true };
  });
}

// ───────────── Variantes ─────────────

export async function generateVariantsAction(raw: GenerateVariantsInput): Promise<ActionResult<{ created: number }>> {
  return run<{ created: number }>(async () => {
    const admin = await assertAdmin();
    const i = generateVariantsSchema.parse(raw);
    const [product, sizes, colors] = await Promise.all([
      prisma.product.findUnique({ where: { id: i.productId }, select: { sku: true } }),
      prisma.size.findMany({ where: { id: { in: i.sizeIds } } }),
      prisma.color.findMany({ where: { id: { in: i.colorIds } } }),
    ]);
    if (!product) throw new UserError("Producto no encontrado.");
    const existing = await prisma.productVariant.findMany({ where: { productId: i.productId }, select: { sizeId: true, colorId: true } });
    const have = new Set(existing.map((e) => `${e.colorId}:${e.sizeId}`));
    let created = 0;
    await prisma.$transaction(async (tx) => {
      for (const c of colors) {
        for (const s of sizes) {
          if (have.has(`${c.id}:${s.id}`)) continue;
          const base = `${product.sku}-${slugify(c.name).toUpperCase()}-${s.name.toUpperCase()}`;
          const sku = (await tx.productVariant.findUnique({ where: { sku: base } })) ? `${base}-${randomBytes(2).toString("hex").toUpperCase()}` : base;
          const v = await tx.productVariant.create({ data: { productId: i.productId, sizeId: s.id, colorId: c.id, sku, stock: 0, minStock: i.minStock } });
          if (i.stock > 0) await applyStockDelta(tx, { variantId: v.id, delta: i.stock, type: "ENTRADA", reason: "Stock inicial", userId: admin.id });
          created++;
        }
      }
    });
    await logAudit(admin.id, "GENERATE_VARIANTS", "Product", i.productId, { created });
    refreshStore();
    revalidatePath(`/admin/productos/${i.productId}`);
    return { ok: true, data: { created }, message: created ? `${created} variantes creadas.` : "Todas esas combinaciones ya existían." };
  });
}

export async function updateVariantAction(raw: VariantUpdateInput): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const i = variantUpdateSchema.parse(raw);
    const v = await prisma.productVariant.findUnique({ where: { id: i.id }, include: { product: { select: { price: true } } } });
    if (!v) throw new UserError("Variante no encontrada.");
    if (i.price != null && i.price <= 0) throw new UserError("El precio específico debe ser mayor a 0 (o vacío para usar el del producto).");
    await prisma.$transaction(async (tx) => {
      await tx.productVariant.update({ where: { id: i.id }, data: { minStock: i.minStock, isActive: i.isActive, price: i.price != null ? dec(toCents(i.price)) : null } });
      // El stock siempre cambia mediante un movimiento de inventario auditable
      await setStockExact(tx, i.id, i.stock, "Ajuste desde ficha de producto", admin.id);
    });
    await logAudit(admin.id, "UPDATE_VARIANT", "ProductVariant", i.id, { stock: i.stock, price: i.price ?? null });
    refreshStore();
    scheduleStockAlerts();
    revalidatePath(`/admin/productos/${v.productId}`);
    revalidatePath("/admin/inventario");
    return { ok: true, message: "Variante actualizada." };
  });
}

export async function deleteVariantAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const v = await prisma.productVariant.findUnique({ where: { id }, select: { productId: true, _count: { select: { orderItems: true } } } });
    if (!v) throw new UserError("Variante no encontrada.");
    if (v._count.orderItems > 0) throw new UserError("Esta variante tiene ventas registradas. Desactívala en lugar de eliminarla.");
    await prisma.productVariant.delete({ where: { id } });
    await logAudit(admin.id, "DELETE_VARIANT", "ProductVariant", id);
    refreshStore();
    revalidatePath(`/admin/productos/${v.productId}`);
    return { ok: true, message: "Variante eliminada." };
  });
}

/** Actualización masiva de precios (porcentaje o monto) sobre una selección de productos */
export async function bulkPriceAction(raw: { ids: string[]; mode: "PERCENT" | "SET"; value: number }): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    if (!raw.ids.length) throw new UserError("Selecciona productos.");
    if (raw.mode === "SET" ? !(raw.value > 0) : !(raw.value !== 0 && raw.value > -90 && raw.value <= 500)) throw new UserError("Ingresa un valor válido (porcentaje entre -90 y 500, o un precio mayor a 0).");
    const products = await prisma.product.findMany({ where: { id: { in: raw.ids } }, select: { id: true, price: true, salePrice: true } });
    await prisma.$transaction(
      products.map((p) => {
        const price = raw.mode === "SET" ? toCents(raw.value) : Math.round(Number(p.price) * 100 * (1 + raw.value / 100));
        const sale = p.salePrice && Number(p.salePrice) * 100 < price ? p.salePrice : null;
        return prisma.product.update({ where: { id: p.id }, data: { price: new Prisma.Decimal((price / 100).toFixed(2)), salePrice: sale } });
      }),
    );
    await logAudit(admin.id, "BULK_PRICE", "Product", null, { count: products.length, mode: raw.mode, value: raw.value });
    refreshStore();
    revalidatePath("/admin/productos");
    return { ok: true, message: `Precios actualizados en ${products.length} productos.` };
  });
}
