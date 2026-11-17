import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getFavoriteProducts } from "@/lib/services/catalog";
import { ProductGrid } from "@/components/products/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Mis favoritos", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const user = await getCurrentUser();
  const products = user ? await getFavoriteProducts(user.id) : [];
  return (
    <div className="container-page py-8 sm:py-12">
      <h1 className="mb-8 flex items-center gap-3 text-3xl font-extrabold tracking-tight"><Heart className="h-7 w-7 fill-brand text-brand" /> Mis favoritos</h1>
      {!user ? (
        <EmptyState icon={Heart} title="Inicia sesión para ver tus favoritos" description="Guarda las prendas que te encantan y encuéntralas cuando quieras." action={<LinkButton href="/login?next=/favoritos">Iniciar sesión</LinkButton>} />
      ) : products.length === 0 ? (
        <EmptyState icon={Heart} title="Aún no tienes favoritos" description="Toca el corazón en cualquier producto para guardarlo aquí." action={<LinkButton href="/catalogo">Explorar catálogo</LinkButton>} />
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}
