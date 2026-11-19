import type { Prisma } from "@prisma/client";

/** Máximo de productos que muestra un catálogo compartido (la página se renderiza completa). */
export const SHARE_CATALOG_MAX_PRODUCTS = 300;

export type ShareScope = { categoryIds: string[]; productIds: string[]; onlyInStock: boolean };

/**
 * Filtro de productos de un catálogo compartido.
 * Prioridad: productos elegidos > categorías elegidas > todo el catálogo. Solo productos ACTIVOS.
 */
export function shareCatalogWhere(s: ShareScope): Prisma.ProductWhereInput {
  return {
    status: "ACTIVE",
    ...(s.productIds.length ? { id: { in: s.productIds } } : s.categoryIds.length ? { categoryId: { in: s.categoryIds } } : {}),
    ...(s.onlyInStock ? { variants: { some: { isActive: true, stock: { gt: 0 } } } } : {}),
  };
}

export type ShareState = { isActive: boolean; expiresAt: Date | string | null };

/** Un enlace es visible si está activo y no venció. */
export function isShareLive(c: ShareState, now = new Date()) {
  if (!c.isActive) return false;
  return !c.expiresAt || new Date(c.expiresAt).getTime() > now.getTime();
}

export function shareStatus(c: ShareState, now = new Date()): "active" | "inactive" | "expired" {
  if (!c.isActive) return "inactive";
  if (c.expiresAt && new Date(c.expiresAt).getTime() <= now.getTime()) return "expired";
  return "active";
}

/** Mensaje prellenado para enviar el enlace del catálogo por WhatsApp. */
export function shareWhatsAppText(title: string, url: string, storeName: string) {
  return `Hola 👋 Te comparto el catálogo «${title}» de ${storeName}:\n${url}`;
}
