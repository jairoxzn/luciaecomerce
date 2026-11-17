import type { InventoryMovementType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/action";

type Tx = Prisma.TransactionClient | typeof prisma;

export type StockChange = { stockBefore: number; stockAfter: number; crossedLow: boolean };

/**
 * Cambia el stock de una variante de forma ATÓMICA y segura ante concurrencia:
 * un único UPDATE condicional (bloqueo de fila) que impide que el stock quede negativo,
 * y registra el movimiento de inventario en la misma transacción.
 */
export async function applyStockDelta(
  tx: Tx,
  p: { variantId: string; delta: number; type: InventoryMovementType; reason?: string | null; orderId?: string | null; userId?: string | null },
): Promise<StockChange> {
  if (!Number.isInteger(p.delta) || p.delta === 0) throw new UserError("La cantidad debe ser un número entero distinto de cero.");
  const rows = await tx.$queryRaw<{ stock: number; minStock: number }[]>`
    UPDATE "ProductVariant"
       SET "stock" = "stock" + ${p.delta}, "updatedAt" = now()
     WHERE "id" = ${p.variantId} AND "stock" + ${p.delta} >= 0
 RETURNING "stock", "minStock"`;
  if (rows.length === 0) {
    const exists = await tx.productVariant.findUnique({ where: { id: p.variantId }, select: { id: true } });
    if (!exists) throw new UserError("La variante no existe.");
    throw new UserError("Stock insuficiente para completar la operación.");
  }
  const stockAfter = rows[0].stock;
  const stockBefore = stockAfter - p.delta;
  await tx.inventoryMovement.create({
    data: {
      variantId: p.variantId,
      type: p.type,
      quantity: p.delta,
      stockBefore,
      stockAfter,
      reason: p.reason ?? null,
      orderId: p.orderId ?? null,
      userId: p.userId ?? null,
    },
  });
  return { stockBefore, stockAfter, crossedLow: stockBefore > rows[0].minStock && stockAfter <= rows[0].minStock };
}

/** Fija el stock a un valor exacto (ajuste de inventario físico). */
export async function setStockExact(tx: Tx, variantId: string, target: number, reason: string, userId: string) {
  if (!Number.isInteger(target) || target < 0) throw new UserError("El stock debe ser un entero mayor o igual a 0.");
  // Bloquea la fila para calcular el delta contra el valor vigente
  const rows = await tx.$queryRaw<{ stock: number }[]>`SELECT "stock" FROM "ProductVariant" WHERE "id" = ${variantId} FOR UPDATE`;
  if (!rows.length) throw new UserError("La variante no existe.");
  const delta = target - rows[0].stock;
  if (delta === 0) return null;
  return applyStockDelta(tx, { variantId, delta, type: "AJUSTE", reason, userId });
}
