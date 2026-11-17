"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { run, UserError, type ActionResult } from "@/lib/action";
import { assertAdmin } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { refreshStore } from "@/lib/revalidate";
import { applyStockDelta, setStockExact } from "@/lib/services/inventory";
import { notifyLowStock } from "@/lib/services/notifications";
import { inventoryAdjustSchema, type InventoryAdjustInput } from "@/lib/validations/admin";

export async function adjustInventoryAction(raw: InventoryAdjustInput): Promise<ActionResult<{ stock: number }>> {
  return run<{ stock: number }>(async () => {
    const admin = await assertAdmin();
    const i = inventoryAdjustSchema.parse(raw);
    if (i.mode !== "AJUSTE" && i.quantity < 1) throw new UserError("La cantidad debe ser al menos 1.");
    const result = await prisma.$transaction(async (tx) => {
      if (i.mode === "AJUSTE") {
        const r = await setStockExact(tx, i.variantId, i.quantity, i.reason, admin.id);
        const v = await tx.productVariant.findUniqueOrThrow({ where: { id: i.variantId }, select: { stock: true } });
        return { stock: v.stock, crossedLow: r?.crossedLow ?? false };
      }
      const r = await applyStockDelta(tx, { variantId: i.variantId, delta: i.mode === "ENTRADA" ? i.quantity : -i.quantity, type: i.mode, reason: i.reason, userId: admin.id });
      return { stock: r.stockAfter, crossedLow: r.crossedLow };
    });
    if (result.crossedLow) await notifyLowStock(i.variantId, result.stock);
    await logAudit(admin.id, `INVENTORY_${i.mode}`, "ProductVariant", i.variantId, { quantity: i.quantity, reason: i.reason });
    refreshStore();
    revalidatePath("/admin/inventario");
    return { ok: true, data: { stock: result.stock }, message: `Stock actualizado: ${result.stock} unidades.` };
  });
}
