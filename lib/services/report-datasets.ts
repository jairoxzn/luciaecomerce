import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/constants";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { frequentCustomers, inventoryReport, lowStockVariants, ordersByStatus, paymentMethodsReport, salesByCategory, salesByPeriod, salesByProduct, type DateRange } from "@/lib/services/reports";

export type ReportType = "ventas-diarias" | "ventas-semanales" | "ventas-mensuales" | "ventas-producto" | "ventas-categoria" | "mas-vendidos" | "stock-bajo" | "inventario" | "pedidos-estado" | "metodos-pago" | "clientes-frecuentes";

export type Column = { key: string; label: string; kind?: "money" | "int" | "text" };
export type Dataset = { type: ReportType; title: string; description: string; columns: Column[]; rows: Record<string, string | number>[]; totals?: Record<string, number> };

export const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "ventas-diarias", label: "Ventas diarias" },
  { value: "ventas-semanales", label: "Ventas semanales" },
  { value: "ventas-mensuales", label: "Ventas mensuales" },
  { value: "ventas-producto", label: "Ventas por producto" },
  { value: "ventas-categoria", label: "Ventas por categoría" },
  { value: "mas-vendidos", label: "Productos más vendidos" },
  { value: "stock-bajo", label: "Stock bajo" },
  { value: "inventario", label: "Inventario" },
  { value: "pedidos-estado", label: "Pedidos por estado" },
  { value: "metodos-pago", label: "Métodos de pago" },
  { value: "clientes-frecuentes", label: "Clientes frecuentes" },
];

export const isReportType = (v: string): v is ReportType => REPORT_TYPES.some((t) => t.value === v);

const money: Column["kind"] = "money";
const int: Column["kind"] = "int";

export async function getDataset(type: ReportType, range: DateRange): Promise<Dataset> {
  const label = REPORT_TYPES.find((t) => t.value === type)!.label;
  const base = { type, title: label };
  switch (type) {
    case "ventas-diarias":
    case "ventas-semanales":
    case "ventas-mensuales": {
      const unit = type === "ventas-diarias" ? "day" : type === "ventas-semanales" ? "week" : "month";
      const data = await salesByPeriod(range, unit);
      return { ...base, description: unit === "week" ? "Semanas que inician en lunes (hora de Lima). Solo pedidos con pago confirmado o posterior." : "Solo pedidos con pago confirmado o posterior, sin cancelados.", columns: [{ key: "label", label: unit === "month" ? "Mes (1.er día)" : unit === "week" ? "Semana (inicio)" : "Fecha" }, { key: "orders", label: "Pedidos", kind: int }, { key: "total", label: "Ventas (S/)", kind: money }], rows: data.map((d) => ({ label: d.label, orders: d.orders, total: d.total })), totals: { orders: data.reduce((s, d) => s + d.orders, 0), total: data.reduce((s, d) => s + d.total, 0) } };
    }
    case "ventas-producto":
    case "mas-vendidos": {
      const data = await salesByProduct(range, type === "mas-vendidos" ? 20 : 500);
      return { ...base, description: "Unidades e importe vendidos por producto (pagos confirmados).", columns: [{ key: "name", label: "Producto" }, { key: "sku", label: "SKU" }, { key: "units", label: "Unidades", kind: int }, { key: "total", label: "Ventas (S/)", kind: money }], rows: data.map((d) => ({ ...d })), totals: { units: data.reduce((s, d) => s + d.units, 0), total: data.reduce((s, d) => s + d.total, 0) } };
    }
    case "ventas-categoria": {
      const data = await salesByCategory(range);
      return { ...base, description: "Ventas confirmadas agrupadas por categoría.", columns: [{ key: "name", label: "Categoría" }, { key: "units", label: "Unidades", kind: int }, { key: "total", label: "Ventas (S/)", kind: money }], rows: data.map((d) => ({ ...d })), totals: { units: data.reduce((s, d) => s + d.units, 0), total: data.reduce((s, d) => s + d.total, 0) } };
    }
    case "stock-bajo": {
      const data = await lowStockVariants(1000);
      return { ...base, description: "Variantes activas en o por debajo de su stock mínimo (estado actual, no depende del rango de fechas).", columns: [{ key: "product", label: "Producto" }, { key: "color", label: "Color" }, { key: "size", label: "Talla" }, { key: "sku", label: "SKU" }, { key: "stock", label: "Stock", kind: int }, { key: "minStock", label: "Mínimo", kind: int }], rows: data.map((d) => ({ product: d.product, color: d.color, size: d.size, sku: d.sku, stock: d.stock, minStock: d.minStock })) };
    }
    case "inventario": {
      const data = await inventoryReport();
      return { ...base, description: "Existencias actuales por variante (no depende del rango de fechas).", columns: [{ key: "product", label: "Producto" }, { key: "color", label: "Color" }, { key: "size", label: "Talla" }, { key: "sku", label: "SKU" }, { key: "stock", label: "Stock", kind: int }, { key: "minStock", label: "Mínimo", kind: int }, { key: "value", label: "Valor (S/)", kind: money }], rows: data.map((d) => ({ product: d.product, color: d.color, size: d.size, sku: d.sku, stock: d.stock, minStock: d.minStock, value: Math.round(d.stock * d.price * 100) / 100 })), totals: { stock: data.reduce((s, d) => s + d.stock, 0), value: data.reduce((s, d) => s + d.stock * d.price, 0) } };
    }
    case "pedidos-estado": {
      const data = await ordersByStatus(range);
      return { ...base, description: "Cantidad de pedidos creados en el período, por estado actual.", columns: [{ key: "status", label: "Estado" }, { key: "count", label: "Pedidos", kind: int }], rows: data.map((d) => ({ status: ORDER_STATUS_LABEL[d.status as OrderStatus], count: d.count })), totals: { count: data.reduce((s, d) => s + d.count, 0) } };
    }
    case "metodos-pago": {
      const data = await paymentMethodsReport(range);
      return { ...base, description: "Pedidos creados en el período por método y estado del pago.", columns: [{ key: "method", label: "Método" }, { key: "status", label: "Estado del pago" }, { key: "count", label: "Pedidos", kind: int }, { key: "total", label: "Monto (S/)", kind: money }], rows: data.map((d) => ({ method: PAYMENT_METHOD_LABEL[d.method as PaymentMethod], status: PAYMENT_STATUS_LABEL[d.status as PaymentStatus], count: d.count, total: d.total })) };
    }
    case "clientes-frecuentes": {
      const data = await frequentCustomers(range, 50);
      return { ...base, description: "Clientes con más pedidos pagados en el período.", columns: [{ key: "name", label: "Cliente" }, { key: "email", label: "Correo" }, { key: "orders", label: "Pedidos", kind: int }, { key: "total", label: "Compras (S/)", kind: money }], rows: data.map((d) => ({ ...d })), totals: { orders: data.reduce((s, d) => s + d.orders, 0), total: data.reduce((s, d) => s + d.total, 0) } };
    }
  }
}
