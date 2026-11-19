import { prisma } from "@/lib/prisma";
import { PAID_STATUSES } from "@/lib/constants";
import { startOfLimaDay, startOfLimaMonth } from "@/lib/utils";

/**
 * Reportes y estadísticas (datos reales de PostgreSQL).
 * "Venta" = pedido con pago confirmado o posterior, sin cancelar (PAID_STATUSES).
 * Las fechas se agrupan en hora de Lima (America/Lima).
 */

const paid = PAID_STATUSES as string[];
const n = (v: unknown) => Number(v ?? 0);

export type DateRange = { from: Date; to: Date };

export function defaultRange(days = 30): DateRange {
  const to = new Date();
  const from = new Date(startOfLimaDay(to).getTime() - (days - 1) * 86400_000);
  return { from, to };
}

export type SalesPoint = { label: string; total: number; orders: number };

export async function salesByPeriod(range: DateRange, unit: "day" | "week" | "month"): Promise<SalesPoint[]> {
  const rows = await prisma.$queryRaw<{ label: string; total: unknown; orders: unknown }[]>`
    SELECT to_char(date_trunc(${unit}, o."createdAt" AT TIME ZONE 'America/Lima'), 'YYYY-MM-DD') AS label,
           SUM(o."total") AS total, COUNT(*) AS orders
      FROM "Order" o
     WHERE o."status"::text = ANY(${paid}::text[]) AND o."createdAt" >= ${range.from} AND o."createdAt" <= ${range.to}
     GROUP BY 1 ORDER BY 1`;
  return rows.map((r) => ({ label: r.label, total: n(r.total), orders: n(r.orders) }));
}

/** Serie diaria continua (rellena con 0 los días sin ventas) */
export async function dailySeries(range: DateRange): Promise<SalesPoint[]> {
  const raw = await salesByPeriod(range, "day");
  const map = new Map(raw.map((r) => [r.label, r]));
  const out: SalesPoint[] = [];
  const start = startOfLimaDay(range.from).getTime();
  const end = startOfLimaDay(range.to).getTime();
  for (let t = start; t <= end; t += 86400_000) {
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date(t + 3600_000));
    out.push(map.get(key) ?? { label: key, total: 0, orders: 0 });
  }
  return out;
}

export async function salesByProduct(range: DateRange, limit = 50) {
  const rows = await prisma.$queryRaw<{ name: string; sku: string; units: unknown; total: unknown }[]>`
    SELECT i."name", MIN(i."sku") AS sku, SUM(i."quantity") AS units, SUM(i."lineTotal") AS total
      FROM "OrderItem" i JOIN "Order" o ON o."id" = i."orderId"
     WHERE o."status"::text = ANY(${paid}::text[]) AND o."createdAt" >= ${range.from} AND o."createdAt" <= ${range.to}
     GROUP BY i."productId", i."name" ORDER BY units DESC, total DESC LIMIT ${limit}`;
  return rows.map((r) => ({ name: r.name, sku: r.sku, units: n(r.units), total: n(r.total) }));
}

export async function salesByCategory(range: DateRange) {
  const rows = await prisma.$queryRaw<{ name: string; units: unknown; total: unknown }[]>`
    SELECT c."name", SUM(i."quantity") AS units, SUM(i."lineTotal") AS total
      FROM "OrderItem" i
      JOIN "Order" o ON o."id" = i."orderId"
      JOIN "Product" p ON p."id" = i."productId"
      JOIN "Category" c ON c."id" = p."categoryId"
     WHERE o."status"::text = ANY(${paid}::text[]) AND o."createdAt" >= ${range.from} AND o."createdAt" <= ${range.to}
     GROUP BY c."name" ORDER BY total DESC`;
  return rows.map((r) => ({ name: r.name, units: n(r.units), total: n(r.total) }));
}

export async function ordersByStatus(range: DateRange) {
  const rows = await prisma.order.groupBy({ by: ["status"], where: { createdAt: { gte: range.from, lte: range.to } }, _count: { _all: true } });
  return rows.map((r) => ({ status: r.status, count: r._count._all }));
}

export async function paymentMethodsReport(range: DateRange) {
  const rows = await prisma.$queryRaw<{ method: string; status: string; count: unknown; total: unknown }[]>`
    SELECT p."method"::text AS method, p."status"::text AS status, COUNT(*) AS count, SUM(p."amount") AS total
      FROM "Payment" p JOIN "Order" o ON o."id" = p."orderId"
     WHERE o."createdAt" >= ${range.from} AND o."createdAt" <= ${range.to}
     GROUP BY 1, 2 ORDER BY 1, 2`;
  return rows.map((r) => ({ method: r.method, status: r.status, count: n(r.count), total: n(r.total) }));
}

export async function frequentCustomers(range: DateRange, limit = 20) {
  const rows = await prisma.$queryRaw<{ name: string; email: string; orders: unknown; total: unknown }[]>`
    SELECT MIN(o."firstName" || ' ' || o."lastName") AS name, o."email", COUNT(*) AS orders, SUM(o."total") AS total
      FROM "Order" o
     WHERE o."status"::text = ANY(${paid}::text[]) AND o."createdAt" >= ${range.from} AND o."createdAt" <= ${range.to}
     GROUP BY o."email" ORDER BY orders DESC, total DESC LIMIT ${limit}`;
  return rows.map((r) => ({ name: r.name, email: r.email, orders: n(r.orders), total: n(r.total) }));
}

export async function lowStockVariants(limit = 200) {
  const rows = await prisma.$queryRaw<{ id: string; product: string; sku: string; color: string; size: string; stock: number; minStock: number }[]>`
    SELECT v."id", p."name" AS product, v."sku", c."name" AS color, s."name" AS size, v."stock", v."minStock"
      FROM "ProductVariant" v
      JOIN "Product" p ON p."id" = v."productId"
      JOIN "Color" c ON c."id" = v."colorId"
      JOIN "Size" s ON s."id" = v."sizeId"
     WHERE v."isActive" = true AND p."status" = 'ACTIVE' AND v."stock" <= v."minStock"
     ORDER BY v."stock" ASC, p."name" ASC LIMIT ${limit}`;
  return rows;
}

/** Cantidad de variantes con stock bajo (COUNT en la base de datos: no trae filas solo para contarlas). */
export async function lowStockCount() {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n
      FROM "ProductVariant" v JOIN "Product" p ON p."id" = v."productId"
     WHERE v."isActive" = true AND p."status" = 'ACTIVE' AND v."stock" <= v."minStock"`;
  return Number(rows[0]?.n ?? 0);
}

export async function inventoryReport() {
  const rows = await prisma.productVariant.findMany({
    where: { product: { status: { not: "ARCHIVED" } } },
    include: { product: { select: { name: true, price: true, status: true } }, size: true, color: true },
    orderBy: [{ product: { name: "asc" } }, { color: { sortOrder: "asc" } }, { size: { sortOrder: "asc" } }],
  });
  return rows.map((v) => ({ product: v.product.name, sku: v.sku, color: v.color.name, size: v.size.name, stock: v.stock, minStock: v.minStock, price: Number(v.price ?? v.product.price), active: v.isActive }));
}

// ───────────────────────── Dashboard ─────────────────────────

export async function dashboardData() {
  const now = new Date();
  const today = startOfLimaDay(now);
  const month = startOfLimaMonth(now);
  const monthsBack = new Date(month);
  monthsBack.setMonth(monthsBack.getMonth() - 11);

  const sumPaid = (from?: Date) => prisma.order.aggregate({ _sum: { total: true }, _count: { _all: true }, where: { status: { in: PAID_STATUSES }, ...(from ? { createdAt: { gte: from } } : {}) } });

  const [salesToday, salesMonth, revenue, pending, delivered, customers, activeProducts, low, lowTotal, daily, monthly, top, byCategory, byStatus, recent] = await Promise.all([
    sumPaid(today),
    sumPaid(month),
    sumPaid(),
    prisma.order.count({ where: { status: { in: ["PENDIENTE", "PAGO_EN_REVISION"] } } }),
    prisma.order.count({ where: { status: "ENTREGADO" } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.product.count({ where: { status: "ACTIVE" } }),
    lowStockVariants(8),
    lowStockCount(),
    dailySeries({ from: new Date(today.getTime() - 29 * 86400_000), to: now }),
    salesByPeriod({ from: monthsBack, to: now }, "month"),
    salesByProduct({ from: new Date(today.getTime() - 29 * 86400_000), to: now }, 5),
    salesByCategory({ from: month, to: now }),
    ordersByStatus({ from: new Date(0), to: now }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { payment: { select: { status: true, method: true } } } }),
  ]);

  return {
    kpis: {
      salesToday: Number(salesToday._sum.total ?? 0),
      ordersToday: salesToday._count._all,
      salesMonth: Number(salesMonth._sum.total ?? 0),
      ordersMonth: salesMonth._count._all,
      revenue: Number(revenue._sum.total ?? 0),
      pending,
      delivered,
      customers,
      activeProducts,
      lowStock: lowTotal,
    },
    daily,
    monthly,
    top,
    byCategory,
    byStatus,
    lowStockList: low,
    recent: recent.map((o) => ({ id: o.id, code: o.code, name: `${o.firstName} ${o.lastName}`, total: Number(o.total), status: o.status, createdAt: o.createdAt.toISOString(), paymentStatus: o.payment?.status ?? null })),
  };
}
