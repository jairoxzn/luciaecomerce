"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Flame, Heart, LogOut, Menu, Package, Search, ShoppingBag, User, LayoutDashboard, X } from "lucide-react";
import { toast } from "sonner";
import { logoutAction } from "@/app/actions/auth";
import { useCart, cartCount } from "@/hooks/use-cart";
import { useFavorites } from "@/hooks/use-favorites";
import { useSession } from "@/hooks/use-session";
import { Logo } from "@/components/ui/logo";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { NavCategory } from "@/lib/services/catalog";
import { SearchBox } from "./search-box";

type Props = {
  storeName: string;
  logoUrl: string | null;
  categories: NavCategory[];
};

export function SiteHeader({ storeName, logoUrl, categories }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const cartQty = useCart((s) => cartCount(s.items));
  const hydrated = useCart((s) => s.hydrated);
  const openDrawer = useCart((s) => s.openDrawer);
  const favCount = useFavorites((s) => s.ids.size);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  // Modo compacto (menú hamburguesa): se activa solo cuando el menú de escritorio NO cabe en la fila, sea cual sea
  // la cantidad o el largo de las categorías que cargue el administrador.
  const rowRef = useRef<HTMLDivElement>(null);
  const failedAt = useRef(0);
  const [compact, setCompact] = useState(false);
  const count = hydrated ? cartQty : 0;

  useLayoutEffect(() => {
    let raf = 0;
    const check = () => {
      const row = rowRef.current;
      if (!row) return;
      const w = window.innerWidth;
      if (w < 1280) return void setCompact(false); // por debajo de `xl` el CSS ya muestra el menú móvil
      if (compact) {
        if (w > failedAt.current + 8) setCompact(false); // se ensanchó: se vuelve a probar el menú de escritorio
        return;
      }
      if (row.scrollWidth > row.clientWidth + 1) {
        failedAt.current = w;
        setCompact(true);
      }
    };
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("resize", onResize);
    const fonts = document.fonts?.ready.then(check); // al cargar la tipografía cambian los anchos
    void fonts;
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [compact, categories]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  async function logout() {
    await logoutAction();
    useCart.getState().clear();
    useSession.getState().clear();
    toast.success("Sesión cerrada");
    router.push("/");
    router.refresh();
  }

  const link = "relative max-w-[13rem] shrink-0 truncate whitespace-nowrap rounded-full px-2.5 py-2 text-sm font-medium transition-colors hover:text-brand";
  const pill = "bg-brand text-white shadow-soft hover:text-white"; // enlace de la página actual
  const active = (href: string) => pathname === href;

  return (
    <header className={cn("sticky top-0 z-40 bg-white/95 backdrop-blur transition-shadow", scrolled ? "shadow-[0_4px_24px_-12px_rgba(0,0,0,0.22)]" : "shadow-[0_1px_0_rgba(0,0,0,0.05)]")}>
      <div ref={rowRef} className="mx-auto flex h-16 w-full max-w-[90rem] items-center gap-2 px-3 min-[360px]:gap-3 min-[360px]:px-4 sm:h-[72px] sm:px-6 lg:px-8">
        <button onClick={() => setMobileOpen(true)} className={cn("-ml-2 shrink-0 rounded-full p-2 transition hover:bg-brand-tint", !compact && "xl:hidden")} aria-label="Abrir menú">
          <Menu className="h-6 w-6" />
        </button>

        <Logo logoUrl={logoUrl} name={storeName} className="h-9 shrink-0 sm:h-11" priority />

        <nav className={cn("ml-3 shrink-0 items-center", compact ? "hidden" : "hidden xl:flex")} aria-label="Principal">
          <Link href="/" className={cn(link, active("/") && pill)}>Inicio</Link>
          {categories.map((c) => (
            <div key={c.id} className="group relative" onMouseEnter={() => setOpenCat(c.id)} onMouseLeave={() => setOpenCat(null)}>
              <Link href={`/categorias/${c.slug}`} className={cn(link, "inline-flex items-center gap-1", pathname.startsWith(`/categorias/${c.slug}`) && pill)}>
                {c.name}
                {c.subcategories.length > 0 && <ChevronDown className="h-3.5 w-3.5 transition group-hover:rotate-180" />}
              </Link>
              {c.subcategories.length > 0 && openCat === c.id && (
                <div className="absolute left-0 top-full z-50 w-64 animate-[pop_0.15s_ease-out] pt-1">
                  <div className="rounded-2xl border border-neutral-100 bg-white p-3 shadow-2xl">
                    <Link href={`/categorias/${c.slug}`} className="mb-1 block rounded-lg px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-tint">Ver todo {c.name}</Link>
                    <ul className="grid grid-cols-1">
                      {c.subcategories.map((s) => (
                        <li key={s.id}>
                          <Link href={`/categorias/${c.slug}?subcategoria=${s.slug}`} className="block rounded-lg px-3 py-2 text-sm hover:bg-brand-tint hover:text-brand">{s.name}</Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ))}
          <Link href="/ofertas" className={cn(link, "inline-flex items-center gap-1", active("/ofertas") && pill)}>Ofertas <Flame className="h-4 w-4 text-orange-500" aria-hidden /></Link>
          <Link href="/nosotros" className={cn(link, active("/nosotros") && pill)}>Nosotros</Link>
          <Link href="/contacto" className={cn(link, active("/contacto") && pill)}>Contacto</Link>
        </nav>

        <div className="ml-auto flex shrink-0 items-center sm:gap-2">
          <SearchBox className={cn("mr-1 hidden w-48", !compact && "xl:block")} />
          <button onClick={() => setSearchOpen((v) => !v)} className={cn("rounded-full p-2 sm:p-2.5 transition hover:bg-brand-tint", !compact && "xl:hidden")} aria-label="Buscar">
            {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>

          <Link href="/favoritos" className="relative rounded-full p-2 sm:p-2.5 transition hover:bg-brand-tint" aria-label="Favoritos">
            <Heart className="h-5 w-5" />
            {favCount > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{favCount}</span>}
          </Link>

          <div className="relative">
            <button onClick={() => setAccountOpen((v) => !v)} className="rounded-full p-2 sm:p-2.5 transition hover:bg-brand-tint" aria-label="Mi cuenta" aria-expanded={accountOpen}>
              <User className="h-5 w-5" />
            </button>
            {accountOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} aria-hidden />
                <div className="absolute right-0 z-50 mt-2 w-60 animate-[pop_0.15s_ease-out] rounded-2xl border border-neutral-100 bg-white p-2 shadow-2xl">
                  {user ? (
                    <>
                      <p className="truncate px-3 py-2 text-sm font-semibold">Hola, {user.name.split(" ")[0]}</p>
                      {user.role === "ADMIN" && (
                        <Link href="/admin/dashboard" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-brand hover:bg-brand-tint"><LayoutDashboard className="h-4 w-4" /> Panel administrativo</Link>
                      )}
                      <Link href="/mi-cuenta" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-brand-tint"><User className="h-4 w-4" /> Mi cuenta</Link>
                      <Link href="/mi-cuenta/pedidos" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-brand-tint"><Package className="h-4 w-4" /> Mis pedidos</Link>
                      <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" /> Cerrar sesión</button>
                    </>
                  ) : (
                    <>
                      <Link href="/login" className="block rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-brand-tint">Iniciar sesión</Link>
                      <Link href="/registro" className="block rounded-lg px-3 py-2.5 text-sm hover:bg-brand-tint">Crear cuenta</Link>
                      <Link href="/pedidos/seguimiento" className="block rounded-lg px-3 py-2.5 text-sm hover:bg-brand-tint">Seguir mi pedido</Link>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          <button onClick={openDrawer} className="relative rounded-full p-2 sm:p-2.5 transition hover:bg-brand-tint" aria-label={`Carrito (${count})`}>
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && <span key={count} className="absolute right-0.5 top-0.5 flex h-4 min-w-4 animate-[pop_0.3s_ease-out] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{count}</span>}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className={cn("container-page animate-[fade-up_0.2s_ease-out] pb-3", !compact && "xl:hidden")}>
          <SearchBox autoFocus onNavigate={() => setSearchOpen(false)} />
        </div>
      )}

      <Modal open={mobileOpen} onClose={() => setMobileOpen(false)} title="Menú" side="left">
        <nav className="-mx-1 flex flex-col" aria-label="Menú móvil">
          <Link href="/" className="rounded-lg px-3 py-3 font-medium hover:bg-brand-tint">Inicio</Link>
          {categories.map((c) => (
            <div key={c.id}>
              <div className="flex items-center">
                <Link href={`/categorias/${c.slug}`} className="flex-1 rounded-lg px-3 py-3 font-medium hover:bg-brand-tint">{c.name}</Link>
                {c.subcategories.length > 0 && (
                  <button onClick={() => setOpenCat(openCat === c.id ? null : c.id)} className="rounded-full p-2 hover:bg-brand-tint" aria-label={`Subcategorías de ${c.name}`} aria-expanded={openCat === c.id}>
                    <ChevronDown className={cn("h-4 w-4 transition", openCat === c.id && "rotate-180")} />
                  </button>
                )}
              </div>
              {openCat === c.id && (
                <ul className="mb-1 ml-3 border-l-2 border-brand-soft pl-3">
                  {c.subcategories.map((s) => (
                    <li key={s.id}><Link href={`/categorias/${c.slug}?subcategoria=${s.slug}`} className="block rounded-lg px-3 py-2 text-sm text-stone hover:text-brand">{s.name}</Link></li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <Link href="/ofertas" className="rounded-lg px-3 py-3 font-semibold text-brand hover:bg-brand-tint">Ofertas</Link>
          <Link href="/nosotros" className="rounded-lg px-3 py-3 font-medium hover:bg-brand-tint">Nosotros</Link>
          <Link href="/contacto" className="rounded-lg px-3 py-3 font-medium hover:bg-brand-tint">Contacto</Link>
          <div className="my-3 border-t border-neutral-100" />
          {user ? (
            <>
              <Link href="/mi-cuenta" className="rounded-lg px-3 py-3 hover:bg-brand-tint">Mi cuenta</Link>
              <Link href="/mi-cuenta/pedidos" className="rounded-lg px-3 py-3 hover:bg-brand-tint">Mis pedidos</Link>
              {user.role === "ADMIN" && <Link href="/admin/dashboard" className="rounded-lg px-3 py-3 font-medium text-brand hover:bg-brand-tint">Panel administrativo</Link>}
              <button onClick={logout} className="rounded-lg px-3 py-3 text-left text-red-600 hover:bg-red-50">Cerrar sesión</button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-3 py-3 font-medium hover:bg-brand-tint">Iniciar sesión</Link>
              <Link href="/registro" className="rounded-lg px-3 py-3 hover:bg-brand-tint">Crear cuenta</Link>
            </>
          )}
        </nav>
      </Modal>
    </header>
  );
}
