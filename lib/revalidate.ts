import { revalidatePath, revalidateTag } from "next/cache";
import { invalidateInBackground } from "@/lib/cache";
import { CATALOG_TAG } from "@/lib/services/catalog";
import { PROMOS_TAG } from "@/lib/services/pricing";
import { SETTINGS_TAG } from "@/lib/services/settings";

/**
 * El stock cambió por una compra o cancelación (no por edición del catálogo): se purgan las páginas de producto
 * cacheadas (ISR) y las entradas de Redis, para que no muestren existencias viejas.
 */
export function refreshStock() {
  revalidatePath("/productos/[slug]", "page");
  invalidateInBackground();
}

/** Invalida cachés de la tienda (Next + Redis) tras cambios de catálogo, precios, promociones o configuración. */
export function refreshStore() {
  revalidateTag(CATALOG_TAG);
  revalidateTag(PROMOS_TAG);
  revalidateTag(SETTINGS_TAG);
  revalidatePath("/", "layout");
  invalidateInBackground();
}
