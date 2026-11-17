import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { getSettings } from "@/lib/services/settings";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = { title: { default: "Panel administrativo", template: "%s | Admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin(); // valida sesión y rol en servidor
  const [settings, orders, payments, messages, notifs] = await Promise.all([
    getSettings(),
    prisma.order.count({ where: { status: { in: ["PENDIENTE", "PAGO_EN_REVISION"] } } }),
    prisma.payment.count({ where: { status: "EN_REVISION" } }),
    prisma.contactMessage.count({ where: { readAt: null } }),
    prisma.notification.findMany({ where: { forAdmin: true }, orderBy: { createdAt: "desc" }, take: 8, include: { order: { select: { code: true } } } }),
  ]);
  return (
    <AdminShell
      user={{ name: user.name, email: user.email }}
      logoUrl={settings.logoUrl}
      storeName={settings.storeName}
      badges={{ orders, payments, messages }}
      notifications={notifs.map((n) => ({ id: n.id, title: n.title, body: n.body, createdAt: n.createdAt.toISOString(), read: !!n.readAt, orderCode: n.order?.code ?? null }))}
    >
      {children}
    </AdminShell>
  );
}
