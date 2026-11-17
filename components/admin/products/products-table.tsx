"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Percent, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { bulkPriceAction, deleteDemoProductsAction, setProductStatusAction } from "@/app/admin/actions/products";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Table, TableEmpty, Td, Th } from "@/components/admin/ui";
import { cn, formatPEN } from "@/lib/utils";

export type ProductRow = { id: string; name: string; sku: string; image: string | null; category: string; subcategory: string | null; price: number; salePrice: number | null; stock: number; variants: number; status: "DRAFT" | "ACTIVE" | "ARCHIVED"; isDemo: boolean; low: boolean };

const STATUS = { ACTIVE: ["Activo", "bg-green-50 text-green-700 ring-green-200"], DRAFT: ["Borrador", "bg-amber-50 text-amber-700 ring-amber-200"], ARCHIVED: ["Archivado", "bg-neutral-100 text-neutral-600 ring-neutral-200"] } as const;

export function ProductsTable({ rows, demoCount }: { rows: ProductRow[]; demoCount: number }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState(false);
  const [mode, setMode] = useState<"PERCENT" | "SET">("PERCENT");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const all = rows.length > 0 && rows.every((r) => sel.has(r.id));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-5 py-3">
        <p className="text-sm text-stone">{sel.size > 0 ? `${sel.size} seleccionados` : `${rows.length} productos en esta página`}</p>
        <div className="flex gap-2">
          {sel.size > 0 && <Button size="sm" variant="dark" onClick={() => setBulk(true)}><Percent className="h-4 w-4" /> Actualizar precios</Button>}
          {demoCount > 0 && <Button size="sm" variant="outline" className="text-red-600" onClick={() => setDemo(true)}><Trash2 className="h-4 w-4" /> Eliminar demo ({demoCount})</Button>}
        </div>
      </div>
      <Table>
        <thead><tr><Th className="w-10"><input type="checkbox" checked={all} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} aria-label="Seleccionar todos" className="h-4 w-4 accent-[#E65385]" /></Th><Th>Producto</Th><Th>Categoría</Th><Th>Precio</Th><Th>Stock</Th><Th>Estado</Th><Th /></tr></thead>
        <tbody>
          {rows.length === 0 && <TableEmpty cols={7} text="No se encontraron productos." />}
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-brand-tint/20">
              <Td><input type="checkbox" checked={sel.has(r.id)} onChange={(e) => setSel((s) => { const n = new Set(s); e.target.checked ? n.add(r.id) : n.delete(r.id); return n; })} aria-label={`Seleccionar ${r.name}`} className="h-4 w-4 accent-[#E65385]" /></Td>
              <Td>
                <Link href={`/admin/productos/${r.id}`} className="flex items-center gap-3">
                  <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-mist">{r.image && <Image src={r.image} alt="" fill sizes="44px" className="object-cover" />}</span>
                  <span className="min-w-0"><span className="block truncate font-semibold hover:text-brand">{r.name} {r.isDemo && <Badge className="ml-1 bg-amber-50 text-amber-700 ring-amber-200">DEMO</Badge>}</span><span className="font-mono text-xs text-stone">{r.sku}</span></span>
                </Link>
              </Td>
              <Td className="text-stone">{r.category}{r.subcategory ? ` · ${r.subcategory}` : ""}</Td>
              <Td>{r.salePrice ? <><span className="font-semibold text-brand">{formatPEN(r.salePrice)}</span> <span className="text-xs text-stone line-through">{formatPEN(r.price)}</span></> : <span className="font-semibold">{formatPEN(r.price)}</span>}</Td>
              <Td><span className={cn("font-semibold", r.stock === 0 ? "text-red-600" : r.low ? "text-amber-600" : "")}>{r.stock}</span> <span className="text-xs text-stone">({r.variants} var.)</span></Td>
              <Td><Badge className={STATUS[r.status][1]}>{STATUS[r.status][0]}</Badge></Td>
              <Td className="text-right">
                <div className="flex justify-end gap-1">
                  <Link href={`/admin/productos/${r.id}`} className="rounded-full px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand-tint">Editar</Link>
                  {r.status === "ACTIVE" && <button onClick={async () => { const x = await setProductStatusAction(r.id, "ARCHIVED"); x.ok ? (toast.success(x.message), router.refresh()) : toast.error(x.error); }} className="rounded-full px-3 py-1.5 text-sm text-stone hover:bg-mist">Archivar</button>}
                  {r.status !== "ACTIVE" && <button onClick={async () => { const x = await setProductStatusAction(r.id, "ACTIVE"); x.ok ? (toast.success(x.message), router.refresh()) : toast.error(x.error); }} className="rounded-full px-3 py-1.5 text-sm text-stone hover:bg-mist">Publicar</button>}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal open={bulk} onClose={() => setBulk(false)} title="Actualizar precios" description={`Se aplicará a ${sel.size} productos. Las ofertas que queden por encima del nuevo precio se eliminan.`} size="sm">
        <div className="space-y-4">
          <Select value={mode} onChange={(e) => setMode(e.target.value as "PERCENT" | "SET")}><option value="PERCENT">Ajuste porcentual (+/- %)</option><option value="SET">Fijar precio exacto (S/)</option></Select>
          <Input type="number" step="0.01" placeholder={mode === "PERCENT" ? "Ej. 10 para subir 10%" : "Ej. 79.90"} value={value} onChange={(e) => setValue(e.target.value)} />
          <p className="text-xs text-stone">Para bajar el precio en porcentaje usa un valor negativo (por ejemplo -10).</p>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setBulk(false)}>Cancelar</Button><Button loading={busy} disabled={!value} onClick={async () => {
            setBusy(true);
            const r = await bulkPriceAction({ ids: [...sel], mode, value: Number(value) });
            setBusy(false);
            if (!r.ok) return toast.error(r.error);
            toast.success(r.message); setBulk(false); setSel(new Set()); router.refresh();
          }}>Aplicar</Button></div>
        </div>
      </Modal>
      <ConfirmDialog open={demo} onClose={() => setDemo(false)} loading={busy} danger title="¿Eliminar todos los productos de demostración?" description="Se borrarán los productos DEMO sin ventas; los que ya tengan ventas se archivarán." confirmLabel="Eliminar demo" onConfirm={async () => {
        setBusy(true);
        const r = await deleteDemoProductsAction();
        setBusy(false);
        if (!r.ok) return toast.error(r.error);
        toast.success(r.message); setDemo(false); router.refresh();
      }} />
    </>
  );
}
