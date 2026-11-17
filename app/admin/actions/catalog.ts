"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { run, UserError, type ActionResult } from "@/lib/action";
import { assertAdmin } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { refreshStore } from "@/lib/revalidate";
import { deleteByUrlOrKey } from "@/lib/storage";
import { slugify } from "@/lib/utils";
import { categorySchema, colorSchema, sizeSchema, subcategorySchema } from "@/lib/validations/admin";

type CategoryIn = import("zod").input<typeof categorySchema>;
type SubIn = import("zod").input<typeof subcategorySchema>;

async function slugFor(model: "category", name: string, excludeId?: string) {
  const root = slugify(name) || "categoria";
  for (let i = 0; i < 30; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    const f = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
    if (!f || f.id === excludeId) return slug;
  }
  throw new UserError("No se pudo generar un identificador único.");
  void model;
}

export async function saveCategoryAction(raw: CategoryIn): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const i = categorySchema.parse(raw);
    const data = { name: i.name, description: i.description ?? null, imageUrl: i.imageUrl, sortOrder: i.sortOrder, isActive: i.isActive, showOnHome: i.showOnHome };
    if (i.id) {
      const prev = await prisma.category.findUnique({ where: { id: i.id }, select: { imageUrl: true } });
      await prisma.category.update({ where: { id: i.id }, data });
      if (prev?.imageUrl && prev.imageUrl !== i.imageUrl) await deleteByUrlOrKey(prev.imageUrl);
    } else {
      await prisma.category.create({ data: { ...data, slug: await slugFor("category", i.name) } });
    }
    await logAudit(admin.id, i.id ? "UPDATE" : "CREATE", "Category", i.id ?? null, { name: i.name });
    refreshStore();
    revalidatePath("/admin/categorias");
    return { ok: true, message: "Categoría guardada." };
  });
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const n = await prisma.product.count({ where: { categoryId: id } });
    if (n > 0) throw new UserError(`No se puede eliminar: tiene ${n} producto(s). Muévelos a otra categoría o desactívala.`);
    const c = await prisma.category.delete({ where: { id } });
    await deleteByUrlOrKey(c.imageUrl);
    await logAudit(admin.id, "DELETE", "Category", id);
    refreshStore();
    revalidatePath("/admin/categorias");
    return { ok: true, message: "Categoría eliminada." };
  });
}

export async function saveSubcategoryAction(raw: SubIn): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const i = subcategorySchema.parse(raw);
    const slug = slugify(i.name);
    if (!slug) throw new UserError("Nombre inválido.");
    const dupe = await prisma.subcategory.findFirst({ where: { categoryId: i.categoryId, slug, ...(i.id ? { id: { not: i.id } } : {}) } });
    if (dupe) throw new UserError("Ya existe una subcategoría con ese nombre en esta categoría.");
    if (i.id) await prisma.subcategory.update({ where: { id: i.id }, data: { name: i.name, slug, sortOrder: i.sortOrder, isActive: i.isActive } });
    else await prisma.subcategory.create({ data: { categoryId: i.categoryId, name: i.name, slug, sortOrder: i.sortOrder, isActive: i.isActive } });
    await logAudit(admin.id, i.id ? "UPDATE" : "CREATE", "Subcategory", i.id ?? null, { name: i.name });
    refreshStore();
    revalidatePath("/admin/categorias");
    return { ok: true, message: "Subcategoría guardada." };
  });
}

export async function deleteSubcategoryAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const n = await prisma.product.count({ where: { subcategoryId: id } });
    if (n > 0) throw new UserError(`No se puede eliminar: tiene ${n} producto(s) asociados.`);
    await prisma.subcategory.delete({ where: { id } });
    await logAudit(admin.id, "DELETE", "Subcategory", id);
    refreshStore();
    revalidatePath("/admin/categorias");
    return { ok: true, message: "Subcategoría eliminada." };
  });
}

export async function saveSizeAction(raw: import("zod").input<typeof sizeSchema>): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const i = sizeSchema.parse(raw);
    await prisma.size.upsert({ where: { name: i.name }, update: { sortOrder: i.sortOrder }, create: { name: i.name, sortOrder: i.sortOrder } });
    await logAudit(admin.id, "SAVE", "Size", null, { name: i.name });
    refreshStore();
    revalidatePath("/admin/categorias");
    return { ok: true, message: "Talla guardada." };
  });
}

export async function deleteSizeAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const n = await prisma.productVariant.count({ where: { sizeId: id } });
    if (n > 0) throw new UserError(`No se puede eliminar: la usan ${n} variante(s).`);
    await prisma.size.delete({ where: { id } });
    await logAudit(admin.id, "DELETE", "Size", id);
    revalidatePath("/admin/categorias");
    return { ok: true, message: "Talla eliminada." };
  });
}

export async function saveColorAction(raw: import("zod").input<typeof colorSchema>): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const i = colorSchema.parse(raw);
    const count = await prisma.color.count();
    await prisma.color.upsert({ where: { name: i.name }, update: { hex: i.hex }, create: { name: i.name, hex: i.hex, sortOrder: count } });
    await logAudit(admin.id, "SAVE", "Color", null, { name: i.name });
    refreshStore();
    revalidatePath("/admin/categorias");
    return { ok: true, message: "Color guardado." };
  });
}

export async function deleteColorAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const n = await prisma.productVariant.count({ where: { colorId: id } });
    if (n > 0) throw new UserError(`No se puede eliminar: lo usan ${n} variante(s).`);
    await prisma.color.delete({ where: { id } });
    await logAudit(admin.id, "DELETE", "Color", id);
    revalidatePath("/admin/categorias");
    return { ok: true, message: "Color eliminado." };
  });
}
