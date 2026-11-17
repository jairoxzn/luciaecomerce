"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteVariantAction, generateVariantsAction, updateVariantAction } from "@/app/admin/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Card, ColorDot, Table, TableEmpty, Td, Th } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export type VariantRow = { id: string; sku: string; sizeName: string; colorName: string; colorHex: string; stock: number; minStock: number; price: number | null; isActive: boolean };
type Opt = { id: string; name: string; hex?: string };

function Row({ v, basePrice }: { v: VariantRow; basePrice: number }) {
  const router = useRouter();
  const [stock, setStock] = useState(String(v.stock));
  const [min, setMin] = useState(String(v.minStock));
  const [price, setPrice] = useState(v.price != null ? String(v.price) : "");
  const [active, setActive] = useState(v.isActive);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  const dirty = stock !== String(v.stock) || min !== String(v.minStock) || price !== (v.price != null ? String(v.price) : "") || active !== v.isActive;
  const low = Number(stock) <= Number(min);

  async function save() {
    setBusy(true);
    const r = await updateVariantAction({ id: v.id, stock: Number(stock), minStock: Number(min), price: price === "" ? null : Number(price), isActive: active });
    setBusy(false);
    r.ok ? (toast.success("Variante guardada"), router.refresh()) : toast.error(r.error);
  }

  return (
    <tr className={cn(!active && "opacity-60")}>
      <Td><span className="flex items-center gap-2 font-medium"><ColorDot hex={v.colorHex} /> {v.colorName}</span></Td>
      <Td className="font-medium">{v.sizeName}</Td>
      <Td className="font-mono text-xs text-stone">{v.sku}</Td>
      <Td><Input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} className={cn("h-9 w-20", low && "border-amber-400 bg-amber-50")} aria-label={`Stock ${v.colorName} ${v.sizeName}`} /></Td>
      <Td><Input type="number" min={0} value={min} onChange={(e) => setMin(e.target.value)} className="h-9 w-16" aria-label="Stock mínimo" /></Td>
      <Td><Input type="number" step="0.01" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder={basePrice.toFixed(2)} className="h-9 w-24" aria-label="Precio específico" /></Td>
      <Td><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[#E65385]" aria-label="Variante activa" /></Td>
      <Td className="text-right">
        <div className="flex justify-end gap-1">
          <Button size="sm" variant={dirty ? "primary" : "ghost"} disabled={!dirty} loading={busy} onClick={save}><Save className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-600" onClick={() => setDel(true)} aria-label="Eliminar variante"><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
        <ConfirmDialog open={del} onClose={() => setDel(false)} danger title="¿Eliminar variante?" description={`${v.colorName} · ${v.sizeName}`} confirmLabel="Eliminar" onConfirm={async () => { const r = await deleteVariantAction(v.id); if (!r.ok) return toast.error(r.error); toast.success("Variante eliminada"); setDel(false); router.refresh(); }} />
      </Td>
    </tr>
  );
}

export function VariantManager({ productId, variants, sizes, colors, basePrice, defaultMinStock }: { productId: string; variants: VariantRow[]; sizes: Opt[]; colors: Opt[]; basePrice: number; defaultMinStock: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<{ sizes: Set<string>; colors: Set<string> }>({ sizes: new Set(), colors: new Set() });
  const [stock, setStock] = useState("0");
  const [busy, setBusy] = useState(false);
  const toggle = (k: "sizes" | "colors", id: string) => setSel((s) => { const n = new Set(s[k]); n.has(id) ? n.delete(id) : n.add(id); return { ...s, [k]: n }; });
  const total = variants.reduce((s, v) => s + v.stock, 0);

  return (
    <Card title="Variantes y stock" action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Agregar variantes</Button>} padded={false}>
      <div className="border-b border-neutral-100 px-5 py-3 text-sm text-stone">{variants.length} variantes · <strong className="text-ink">{total}</strong> unidades en total. Los cambios de stock quedan registrados en el historial de inventario.</div>
      <Table>
        <thead><tr><Th>Color</Th><Th>Talla</Th><Th>SKU</Th><Th>Stock</Th><Th>Mín.</Th><Th>Precio propio</Th><Th>Activa</Th><Th /></tr></thead>
        <tbody>
          {variants.length === 0 && <TableEmpty cols={8} text="Este producto aún no tiene variantes. Agrega combinaciones de color y talla." />}
          {variants.map((v) => <Row key={`${v.id}:${v.stock}:${v.minStock}:${v.price}:${v.isActive}`} v={v} basePrice={basePrice} />)}
        </tbody>
      </Table>

      <Modal open={open} onClose={() => setOpen(false)} title="Agregar variantes" description="Se crean todas las combinaciones de colores y tallas elegidas (las existentes se omiten)." size="lg">
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-semibold">Colores</p>
            <div className="flex flex-wrap gap-2">{colors.map((c) => <button key={c.id} type="button" onClick={() => toggle("colors", c.id)} aria-pressed={sel.colors.has(c.id)} className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition", sel.colors.has(c.id) ? "border-brand bg-brand-tint font-semibold text-brand" : "border-neutral-200 hover:border-brand")}><ColorDot hex={c.hex ?? "#ccc"} />{c.name}</button>)}</div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Tallas</p>
            <div className="flex flex-wrap gap-2">{sizes.map((s) => <button key={s.id} type="button" onClick={() => toggle("sizes", s.id)} aria-pressed={sel.sizes.has(s.id)} className={cn("min-w-11 rounded-lg border px-3 py-1.5 text-sm transition", sel.sizes.has(s.id) ? "border-brand bg-brand text-white" : "border-neutral-200 hover:border-brand")}>{s.name}</button>)}</div>
          </div>
          <div className="max-w-[12rem]">
            <p className="mb-1.5 text-sm font-semibold">Stock inicial por variante</p>
            <Input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-stone">{sel.colors.size * sel.sizes.size} combinaciones</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button loading={busy} disabled={!sel.colors.size || !sel.sizes.size} onClick={async () => {
                setBusy(true);
                const r = await generateVariantsAction({ productId, sizeIds: [...sel.sizes], colorIds: [...sel.colors], stock: Number(stock) || 0, minStock: defaultMinStock });
                setBusy(false);
                if (!r.ok) return toast.error(r.error);
                toast.success(r.message ?? "Listo");
                setOpen(false);
                setSel({ sizes: new Set(), colors: new Set() });
                router.refresh();
              }}>Crear variantes</Button>
            </div>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
