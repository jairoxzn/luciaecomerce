import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/guards";
import { getSettings } from "@/lib/services/settings";
import { getAdminAlerts } from "@/lib/services/admin-alerts";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = { title: { default: "Panel administrativo", template: "%s | Admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin(); // valida sesión y rol en servidor
  const [settings, alerts] = await Promise.all([getSettings(), getAdminAlerts()]);
  return (
    <AdminShell
      user={{ name: user.name, email: user.email }}
      logoUrl={settings.logoUrl}
      storeName={settings.storeName}
      badges={alerts.badges}
      notifications={alerts.notifications}
    >
      {children}
    </AdminShell>
  );
}
