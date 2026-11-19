"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bell, Boxes, CreditCard, ExternalLink, Image as ImageIcon, LayoutDashboard, LogOut, Mail, Menu, Percent, Settings, Share2, ShoppingBag, Shirt, Tags, Ticket, Users } from "lucide-react";
import { toast } from "sonner";
import { logoutAction } from "@/app/actions/auth";
import { markNotificationsReadAction } from "@/app/admin/actions/notifications";
import { Logo } from "@/components/ui/logo";
import { Modal } from "@/components/ui/modal";
import { cn, formatDate } from "@/lib/utils";

export type AdminBadges = { orders: number; payments: number; messages: number };
export type AdminNotification = { id: string; title: string; body: string; createdAt: string; read: boolean; orderCode: string | null };

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/admin/productos", label: "Productos", Icon: Shirt },
  { href: "/admin/catalogo", label: "Catálogo compartido", Icon: Share2 },
  { href: "/admin/categorias", label: "Categorías", Icon: Tags },
  { href: "/admin/inventario", label: "Inventario", Icon: Boxes },
  { href: "/admin/pedidos", label: "Pedidos", Icon: ShoppingBag, badge: "orders" as const },
  { href: "/admin/pagos", label: "Pagos", Icon: CreditCard, badge: "payments" as const },
  { href: "/admin/clientes", label: "Clientes", Icon: Users },
  { href: "/admin/promociones", label: "Promociones", Icon: Percent },
  { href: "/admin/cupones", label: "Cupones", Icon: Ticket },
  { href: "/admin/banners", label: "Banners", Icon: ImageIcon },
  { href: "/admin/reportes", label: "Reportes", Icon: BarChart3 },
  { href: "/admin/mensajes", label: "Mensajes", Icon: Mail, badge: "messages" as const },
  { href: "/admin/configuracion", label: "Configuración", Icon: Settings },
];

function SidebarContent({ logoUrl, storeName, badges, onNavigate }: { logoUrl: string | null; storeName: string; badges: AdminBadges; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-6"><Logo logoUrl={logoUrl} tone="white" name={storeName} className="h-11" /></div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Administración">
        {NAV.map(({ href, label, Icon, badge }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const count = badge ? badges[badge] : 0;
          return (
            <Link key={href} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition", active ? "bg-brand text-white shadow-soft" : "text-neutral-300 hover:bg-white/10 hover:text-white")}>
              <Icon className="h-[18px] w-[18px]" /> <span className="flex-1">{label}</span>
              {count > 0 && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", active ? "bg-white text-brand" : "bg-brand text-white")}>{count}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <Link href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-neutral-300 transition hover:bg-white/10 hover:text-white"><ExternalLink className="h-[18px] w-[18px]" /> Ver tienda</Link>
      </div>
    </div>
  );
}

export function AdminShell({ children, user, logoUrl, storeName, badges, notifications }: { children: React.ReactNode; user: { name: string; email: string }; logoUrl: string | null; storeName: string; badges: AdminBadges; notifications: AdminNotification[] }) {
  const router = useRouter();
  const [mobile, setMobile] = useState(false);
  const [bell, setBell] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-dvh bg-[#f6f4f5]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-ink lg:block"><SidebarContent logoUrl={logoUrl} storeName={storeName} badges={badges} /></aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button onClick={() => setMobile(true)} className="rounded-full p-2 hover:bg-mist lg:hidden" aria-label="Abrir menú"><Menu className="h-6 w-6" /></button>
          <p className="hidden text-sm text-stone sm:block">Panel administrativo</p>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <button onClick={() => { setBell((b) => !b); if (!bell && unread > 0) void markNotificationsReadAction().then(() => router.refresh()); }} className="relative rounded-full p-2.5 hover:bg-mist" aria-label={`Notificaciones (${unread} sin leer)`}>
                <Bell className="h-5 w-5" />
                {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{unread}</span>}
              </button>
              {bell && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setBell(false)} aria-hidden />
                  <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-2xl">
                    <p className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold">Notificaciones</p>
                    {notifications.length === 0 ? <p className="px-4 py-8 text-center text-sm text-stone">Sin notificaciones</p> : (
                      <ul className="max-h-96 divide-y divide-neutral-100 overflow-y-auto">
                        {notifications.map((n) => (
                          <li key={n.id}>
                            <Link href={n.orderCode ? `/admin/pedidos?q=${n.orderCode}` : "/admin/inventario?filtro=bajo"} onClick={() => setBell(false)} className={cn("block px-4 py-3 hover:bg-brand-tint/40", !n.read && "bg-brand-tint/30")}>
                              <p className="text-sm font-semibold">{n.title}</p>
                              <p className="text-xs text-stone">{n.body}</p>
                              <p className="mt-1 text-[11px] text-neutral-400">{formatDate(n.createdAt, true)}</p>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link href="/admin/notificaciones" onClick={() => setBell(false)} className="block border-t border-neutral-100 px-4 py-3 text-center text-sm font-semibold text-brand hover:bg-brand-tint/40">Ver todas</Link>
                  </div>
                </>
              )}
            </div>
            <div className="hidden text-right sm:block"><p className="text-sm font-semibold leading-tight">{user.name}</p><p className="text-xs text-stone">Administrador</p></div>
            <button
              onClick={async () => { await logoutAction(); toast.success("Sesión cerrada"); router.push("/login"); router.refresh(); }}
              className="rounded-full p-2.5 text-stone hover:bg-red-50 hover:text-red-600"
              aria-label="Cerrar sesión"
            ><LogOut className="h-5 w-5" /></button>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <Modal open={mobile} onClose={() => setMobile(false)} side="left" title="Menú">
        <div className="-mx-5 -my-5 bg-ink sm:-mx-6"><SidebarContent logoUrl={logoUrl} storeName={storeName} badges={badges} onNavigate={() => setMobile(false)} /></div>
      </Modal>
    </div>
  );
}
