"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bell, Boxes, CreditCard, ExternalLink, Image as ImageIcon, LayoutDashboard, LogOut, Mail, Menu, Percent, Settings, Share2, ShoppingBag, Shirt, Tags, Ticket, Users, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { logoutAction } from "@/app/actions/auth";
import { markNotificationsReadAction } from "@/app/admin/actions/notifications";
import { Logo } from "@/components/ui/logo";
import { Modal } from "@/components/ui/modal";
import { cn, formatDate } from "@/lib/utils";

import type { AdminAlerts, AdminBadges, AdminNotification } from "@/lib/services/admin-alerts";

export type { AdminBadges, AdminNotification };

const POLL_MS = 15_000;
const SOUND_KEY = "lj-admin-sound";

/** Doble tono corto (WebAudio): avisa de un comprobante o pedido nuevo aunque el panel esté en segundo plano. */
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.16 + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.16);
      osc.stop(ctx.currentTime + i * 0.16 + 0.16);
    });
    setTimeout(() => void ctx.close(), 600);
  } catch {
    /* el navegador bloquea el audio hasta que haya una interacción: no pasa nada */
  }
}

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

export function AdminShell({ children, user, logoUrl, storeName, badges: initialBadges, notifications: initialNotifications }: { children: React.ReactNode; user: { name: string; email: string }; logoUrl: string | null; storeName: string; badges: AdminBadges; notifications: AdminNotification[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobile, setMobile] = useState(false);
  const [bell, setBell] = useState(false);
  const [badges, setBadges] = useState(initialBadges);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [sound, setSound] = useState(true);
  const unread = notifications.filter((n) => !n.read).length;
  const seen = useRef(new Set(initialNotifications.map((n) => n.id)));
  const soundRef = useRef(true);
  const paymentsRef = useRef(initialBadges.payments);

  // Cuando el servidor vuelve a renderizar el layout (navegación o router.refresh) se toman sus datos como base
  useEffect(() => {
    setBadges(initialBadges);
    setNotifications(initialNotifications);
    initialNotifications.forEach((n) => seen.current.add(n.id));
    paymentsRef.current = initialBadges.payments;
  }, [initialBadges, initialNotifications]);

  useEffect(() => {
    try {
      const v = localStorage.getItem(SOUND_KEY) !== "off";
      setSound(v);
      soundRef.current = v;
    } catch { /* noop */ }
  }, []);

  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    try {
      const res = await fetch("/api/admin/alerts", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as AdminAlerts & { ok: boolean };
      if (!data.ok) return;
      const fresh = data.notifications.filter((n) => !seen.current.has(n.id) && !n.read);
      data.notifications.forEach((n) => seen.current.add(n.id));
      setBadges(data.badges);
      setNotifications(data.notifications);
      if (fresh.length > 0) {
        // Un toast por aviso nuevo (máx. 3), con enlace directo a lo que hay que revisar
        fresh.slice(0, 3).reverse().forEach((n) => {
          const toPayments = /comprobante/i.test(n.title);
          toast(n.title, { description: n.body, duration: 10_000, action: { label: toPayments ? "Revisar" : "Ver", onClick: () => router.push(toPayments ? "/admin/pagos" : n.orderCode ? `/admin/pedidos?q=${n.orderCode}` : "/admin/inventario?filtro=bajo") } });
        });
        if (soundRef.current) beep();
      }
      // Si está mirando una lista que acaba de cambiar, se actualiza sola
      if ((data.badges.payments !== paymentsRef.current || fresh.length > 0) && /^\/admin\/(pagos|pedidos|dashboard)/.test(window.location.pathname)) router.refresh();
      paymentsRef.current = data.badges.payments;
    } catch { /* sin red: se reintenta en el siguiente ciclo */ }
  }, [router]);

  useEffect(() => {
    const id = setInterval(poll, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void poll();
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [poll]);

  // Pestaña con el número de pagos por revisar: se ve aunque el panel esté en otra pestaña
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = badges.payments > 0 ? `(${badges.payments}) ${base}` : base;
  }, [badges.payments, pathname]);

  function toggleSound() {
    const v = !sound;
    setSound(v);
    soundRef.current = v;
    try { localStorage.setItem(SOUND_KEY, v ? "on" : "off"); } catch { /* noop */ }
    if (v) beep();
  }

  return (
    <div className="min-h-dvh bg-[#f6f4f5]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-ink lg:block"><SidebarContent logoUrl={logoUrl} storeName={storeName} badges={badges} /></aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button onClick={() => setMobile(true)} className="rounded-full p-2 hover:bg-mist lg:hidden" aria-label="Abrir menú"><Menu className="h-6 w-6" /></button>
          <p className="hidden text-sm text-stone sm:block">Panel administrativo</p>
          <div className="ml-auto flex items-center gap-2">
            {badges.payments > 0 && (
              <Link href="/admin/pagos" className="hidden items-center gap-2 rounded-full bg-amber-100 px-3.5 py-1.5 text-xs font-bold text-amber-900 transition hover:bg-amber-200 sm:inline-flex">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-amber-600" /></span>
                {badges.payments} {badges.payments === 1 ? "pago por revisar" : "pagos por revisar"}
              </Link>
            )}
            <button onClick={toggleSound} className="rounded-full p-2.5 text-stone hover:bg-mist" aria-label={sound ? "Silenciar avisos sonoros" : "Activar avisos sonoros"} aria-pressed={sound} title={sound ? "Sonido de avisos: activado" : "Sonido de avisos: silenciado"}>
              {sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>
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
