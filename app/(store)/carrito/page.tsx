import type { Metadata } from "next";
import { CartPageView } from "@/components/cart/cart-page-view";

// Se renderiza en cada petición (los datos salen de la caché de Redis): el build no consulta la base de datos
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tu carrito", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="container-page py-8 sm:py-12">
      <h1 className="mb-8 text-3xl font-extrabold tracking-tight">Tu carrito</h1>
      <CartPageView />
    </div>
  );
}
