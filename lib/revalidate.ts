import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/services/catalog";
import { PROMOS_TAG } from "@/lib/services/pricing";
import { SETTINGS_TAG } from "@/lib/services/settings";

/** Invalida cachés de la tienda tras cambios de catálogo, precios, promociones o configuración. */
export function refreshStore() {
  revalidateTag(CATALOG_TAG);
  revalidateTag(PROMOS_TAG);
  revalidateTag(SETTINGS_TAG);
  revalidatePath("/", "layout");
}
