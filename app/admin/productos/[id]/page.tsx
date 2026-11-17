import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/services/settings";
import { num } from "@/lib/utils";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/products/product-form";
import { ImageManager } from "@/components/admin/products/image-manager";
import { VariantManager } from "@/components/admin/products/variant-manager";
import { ProductActions } from "@/components/admin/products/product-actions";

export const metadata = { title: "Editar producto" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories, sizes, colors, settings] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        variants: { include: { size: true, color: true }, orderBy: [{ color: { sortOrder: "asc" } }, { size: { sortOrder: "asc" } }] },
      },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, subcategories: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true } } } }),
    prisma.size.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.color.findMany({ orderBy: { sortOrder: "asc" } }),
    getSettings(),
  ]);
  if (!product) notFound();

  return (
    <>
      <Link href="/admin/productos" className="text-sm text-stone hover:text-brand">← Productos</Link>
      <PageHeader
        title={product.name}
        description={`SKU ${product.sku}${product.isDemo ? " · Producto de demostración" : ""}`}
        actions={<ProductActions id={product.id} status={product.status} slug={product.slug} />}
      />
      <div className="space-y-6">
        <ProductForm
          categories={categories}
          product={{
            id: product.id, name: product.name, sku: product.sku, description: product.description, material: product.material ?? "", careInstructions: product.careInstructions ?? "",
            categoryId: product.categoryId, subcategoryId: product.subcategoryId ?? "", price: num(product.price), salePrice: product.salePrice ? num(product.salePrice) : null,
            status: product.status, isFeatured: product.isFeatured, isBestSeller: product.isBestSeller, isNew: product.isNew,
          }}
        />
        <ImageManager productId={product.id} images={product.images.map((i) => ({ id: i.id, url: i.url, colorId: i.colorId }))} colors={colors.map((c) => ({ id: c.id, name: c.name }))} />
        <VariantManager
          productId={product.id}
          basePrice={num(product.price)}
          defaultMinStock={settings.defaultMinStock}
          sizes={sizes.map((s) => ({ id: s.id, name: s.name }))}
          colors={colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex }))}
          variants={product.variants.map((v) => ({ id: v.id, sku: v.sku, sizeName: v.size.name, colorName: v.color.name, colorHex: v.color.hex, stock: v.stock, minStock: v.minStock, price: v.price ? num(v.price) : null, isActive: v.isActive }))}
        />
      </div>
    </>
  );
}
