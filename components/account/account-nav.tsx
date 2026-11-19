"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart, LogOut, MapPin, Package, Ticket, User } from "lucide-react";
import { toast } from "sonner";
import { logoutAction } from "@/app/actions/auth";
import { useCart } from "@/hooks/use-cart";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

const links = [
  { href: "/mi-cuenta/pedidos", label: "Mis pedidos", Icon: Package },
  { href: "/mi-cuenta", label: "Mi perfil", Icon: User, exact: true },
  { href: "/mi-cuenta/direcciones", label: "Mis direcciones", Icon: MapPin },
  { href: "/favoritos", label: "Mis favoritos", Icon: Heart },
  { href: "/mi-cuenta/cupones", label: "Mis cupones", Icon: Ticket },
];

export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <nav aria-label="Mi cuenta" className="no-scrollbar flex gap-2 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
      {links.map(({ href, label, Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={cn("flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition lg:rounded-xl", active ? "bg-brand text-white shadow-soft" : "bg-mist hover:bg-brand-tint hover:text-brand lg:bg-transparent")}>
            <Icon className="h-4 w-4" /> {label}
          </Link>
        );
      })}
      <button
        onClick={async () => {
          await logoutAction();
          useCart.getState().clear();
          useSession.getState().clear();
          toast.success("Sesión cerrada");
          router.push("/");
          router.refresh();
        }}
        className="flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 lg:rounded-xl"
      >
        <LogOut className="h-4 w-4" /> Cerrar sesión
      </button>
    </nav>
  );
}
