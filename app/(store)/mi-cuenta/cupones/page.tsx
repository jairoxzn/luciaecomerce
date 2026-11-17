import type { Metadata } from "next";
import { Ticket } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { formatDate, formatPEN, num } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { CopyButton } from "@/components/account/copy-button";

export const metadata: Metadata = { title: "Mis cupones", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  await requireUser("/mi-cuenta/cupones");
  const now = new Date();
  const coupons = await prisma.coupon.findMany({
    where: { isActive: true, isPublic: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }] },
    orderBy: { createdAt: "desc" },
  });
  const available = coupons.filter((c) => c.usageLimit == null || c.usedCount < c.usageLimit);
  if (available.length === 0) return <EmptyState icon={Ticket} title="No hay cupones disponibles" description="Cuando tengamos nuevas promociones las verás aquí." />;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Mis cupones</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {available.map((c) => (
          <div key={c.id} className="relative overflow-hidden rounded-3xl border border-dashed border-brand bg-brand-tint/50 p-5">
            <p className="text-3xl font-extrabold text-brand">{c.discountType === "PERCENT" ? `${num(c.value)}%` : formatPEN(num(c.value))} <span className="text-base font-semibold text-ink">de descuento</span></p>
            {c.description && <p className="mt-1 text-sm text-stone">{c.description}</p>}
            <div className="mt-4 flex items-center justify-between gap-2">
              <span className="rounded-lg bg-white px-3 py-1.5 font-mono text-sm font-bold tracking-wider shadow-card">{c.code}</span>
              <CopyButton text={c.code} />
            </div>
            <p className="mt-3 text-xs text-stone">{c.minPurchase ? `Compra mínima ${formatPEN(num(c.minPurchase))}. ` : ""}{c.expiresAt ? `Vence el ${formatDate(c.expiresAt)}.` : "Sin fecha de vencimiento."}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-stone">Ingresa el código en tu carrito para aplicarlo.</p>
    </div>
  );
}
