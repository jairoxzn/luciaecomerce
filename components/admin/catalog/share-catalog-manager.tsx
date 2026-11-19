"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { Copy, ExternalLink, Eye, Link2, Pencil, Plus, Power, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteShareCatalogAction, regenerateShareLinkAction, saveShareCatalogAction, toggleShareCatalogAction } from "@/app/admin/actions/share-catalogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch, Textarea } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { WhatsAppIcon } from "@/components/ui/social-icons";
import { Card } from "@/components/admin/ui";
import { shareStatus, shareWhatsAppText } from "@/lib/share-catalog-core";
import { cn, formatDate, limaDateKey, pluralize } from "@/lib/utils";

export type ShareCatalogRow = {
  id: string; token: string; title: string; message: string | null; categoryIds: string[]; productIds: string[];
  showPrices: boolean; onlyInStock: boolean; isActive: boolean; expiresAt: string | null; views: number; createdAt: string; productCount: number;
};
type Product = { id: string; name: string; sku: string; category: string };
type Scope = "all" | "categories" | "products";
type F = { title: string; message: string; scope: Scope; categoryIds: string[]; productIds: string[]; showPrices: boolean; onlyInStock: boolean; isActive: boolean; expiresAt: string };

const STATUS = {
  active: ["Activo", "bg-green-50 text-green-700 ring-green-200"],
  inactive: ["Desactivado", "bg-neutral-100 text-neutral-600 ring-neutral-200"],
  expired: ["Vencido", "bg-red-50 text-red-700 ring-red-200"],
} as const;

const scopeOf = (c: ShareCatalogRow): Scope => (c.productIds.length ? "products" : c.categoryIds.length ? "categories" : "all");
const scopeLabel = (c: ShareCatalogRow, cats: Map<string, string>) =>
  c.productIds.length ? `${c.productIds.length} ${pluralize(c.productIds.length, "producto elegido", "productos elegidos")}`
    : c.categoryIds.length ? c.categoryIds.map((id) => cats.get(id)).filter(Boolean).join(", ") || "Categorías"
      : "Todo el catálogo";

export function ShareCatalogManager({ catalogs, categories, products, storeName }: { catalogs: ShareCatalogRow[]; categories: { id: string; name: string }[]; products: Product[]; storeName: string }) {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const [del, setDel] = useState<ShareCatalogRow | null>(null);
  const [renew, setRenew] = useState<ShareCatalogRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Record<string, string[]> | null>(null);
  const [search, setSearch] = useState("");
  const { register, control, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm<F>();
  const scope = watch("scope");
  const catNames = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  // El enlace se arma con el dominio desde el que el administrador está trabajando
  useEffect(() => setOrigin(window.location.origin), []);
  const urlOf = (c: ShareCatalogRow) => `${origin}/c/${c.token}`;

  const open = (c?: ShareCatalogRow) => {
    reset(c
      ? { title: c.title, message: c.message ?? "", scope: scopeOf(c), categoryIds: c.categoryIds, productIds: c.productIds, showPrices: c.showPrices, onlyInStock: c.onlyInStock, isActive: c.isActive, expiresAt: c.expiresAt ? limaDateKey(new Date(c.expiresAt)) : "" }
      : { title: "", message: "", scope: "all", categoryIds: [], productIds: [], showPrices: true, onlyInStock: false, isActive: true, expiresAt: "" });
    setSearch(""); setError(null); setEditing({ id: c?.id });
  };

  const copy = async (c: ShareCatalogRow) => {
    try { await navigator.clipboard.writeText(urlOf(c)); toast.success("Enlace copiado. Pégalo donde quieras compartirlo."); }
    catch { toast.error("No se pudo copiar. Selecciona el enlace y cópialo manualmente."); }
  };
  const whatsapp = (c: ShareCatalogRow) => window.open(`https://wa.me/?text=${encodeURIComponent(shareWhatsAppText(c.title, urlOf(c), storeName))}`, "_blank", "noopener,noreferrer");
  const act = async (fn: () => ReturnType<typeof toggleShareCatalogAction>) => { const r = await fn(); if (!r.ok) return toast.error(r.error); toast.success(r.message); router.refresh(); };

  const q = search.trim().toLowerCase();
  const visible = q ? products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) : products;

  return (
    <>
      <Card padded={false} title="Mis catálogos" action={<Button size="sm" onClick={() => open()}><Plus className="h-4 w-4" /> Nuevo catálogo</Button>}>
        {catalogs.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-tint text-brand"><Link2 className="h-6 w-6" /></span>
            <p className="font-semibold">Aún no tienes catálogos para compartir</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-stone">Crea uno, elige qué productos mostrar y envía el enlace a tus clientes por WhatsApp.</p>
            <Button className="mt-5" onClick={() => open()}><Plus className="h-4 w-4" /> Crear mi primer catálogo</Button>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {catalogs.map((c) => {
              const st = shareStatus(c);
              const [label, cls] = STATUS[st];
              return (
                <li key={c.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{c.title}</p>
                      <Badge className={cls}>{label}</Badge>
                      {!c.showPrices && <Badge className="bg-sky-50 text-sky-700 ring-sky-200">Sin precios</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-stone">
                      {c.productCount} {pluralize(c.productCount, "producto", "productos")} · {scopeLabel(c, catNames)}{c.onlyInStock ? " · solo con stock" : ""}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-stone">
                      <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {c.views} {pluralize(c.views, "visita", "visitas")}</span>
                      <span>Creado {formatDate(c.createdAt)}</span>
                      {c.expiresAt && <span>Vence {formatDate(c.expiresAt)}</span>}
                    </p>
                    <p className="mt-1.5 truncate rounded-lg bg-neutral-50 px-2.5 py-1.5 font-mono text-xs text-stone" title={origin ? urlOf(c) : undefined}>{origin ? urlOf(c) : `/c/${c.token}`}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => copy(c)} disabled={st !== "active"}><Copy className="h-3.5 w-3.5" /> Copiar enlace</Button>
                    <Button size="sm" className="bg-[#25D366] text-white shadow-none hover:bg-[#1ebe5b]" onClick={() => whatsapp(c)} disabled={st !== "active"}><WhatsAppIcon className="h-4 w-4" /> WhatsApp</Button>
                    <Button size="sm" variant="ghost" onClick={() => window.open(`/c/${c.token}`, "_blank", "noopener,noreferrer")} aria-label="Ver catálogo" title="Ver catálogo"><ExternalLink className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => open(c)} aria-label="Editar" title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => act(() => toggleShareCatalogAction(c.id))} aria-label={c.isActive ? "Desactivar" : "Activar"} title={c.isActive ? "Desactivar" : "Activar"}><Power className={cn("h-3.5 w-3.5", c.isActive ? "text-green-600" : "text-stone")} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setRenew(c)} aria-label="Renovar enlace" title="Renovar enlace"><RefreshCw className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-600" onClick={() => setDel(c)} aria-label="Eliminar" title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Editar catálogo" : "Nuevo catálogo"} description="Define qué verán tus clientes al abrir el enlace." size="lg">
        <form noValidate className="space-y-5" onSubmit={handleSubmit(async (v) => {
          const r = await saveShareCatalogAction({
            id: editing?.id, title: v.title, message: v.message,
            categoryIds: v.scope === "categories" ? v.categoryIds : [], productIds: v.scope === "products" ? v.productIds : [],
            showPrices: v.showPrices, onlyInStock: v.onlyInStock, isActive: v.isActive, expiresAt: v.expiresAt,
          });
          if (!r.ok) { setError(r.fieldErrors ?? null); return toast.error(r.error); }
          toast.success(r.message); setEditing(null); router.refresh();
        })}>
          <Field label="Título" error={error?.title?.[0]}><Input placeholder="Ej. Colección Verano 2026" maxLength={80} {...register("title")} /></Field>
          <Field label="Mensaje de bienvenida (opcional)" error={error?.message?.[0]} hint="Se muestra debajo del título. Ej. «Precios por unidad, envíos a todo el Perú»."><Textarea rows={2} maxLength={400} {...register("message")} /></Field>

          <Controller control={control} name="scope" render={({ field }) => (
            <div>
              <p className="mb-2 text-sm font-medium">¿Qué productos incluye?</p>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Alcance del catálogo">
                {([["all", "Todo el catálogo", "Todos los productos activos"], ["categories", "Por categorías", "Elige una o varias"], ["products", "Productos elegidos", "Selección manual"]] as const).map(([v, t, d]) => (
                  <button key={v} type="button" role="radio" aria-checked={field.value === v} onClick={() => field.onChange(v)} className={cn("rounded-xl border px-3.5 py-3 text-left transition", field.value === v ? "border-brand bg-brand-tint" : "border-neutral-200 hover:border-brand/50")}>
                    <span className={cn("block text-sm font-semibold", field.value === v && "text-brand")}>{t}</span>
                    <span className="block text-xs text-stone">{d}</span>
                  </button>
                ))}
              </div>
            </div>
          )} />

          {scope === "categories" && (
            <Controller control={control} name="categoryIds" render={({ field }) => (
              <div>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => { const on = field.value?.includes(c.id); return <button key={c.id} type="button" aria-pressed={on} onClick={() => field.onChange(on ? field.value.filter((x) => x !== c.id) : [...(field.value ?? []), c.id])} className={cn("rounded-full border px-3 py-1.5 text-sm", on ? "border-brand bg-brand-tint font-semibold text-brand" : "border-neutral-200")}>{c.name}</button>; })}
                </div>
                {(field.value?.length ?? 0) === 0 && <p className="mt-2 text-xs text-amber-700">Sin categorías elegidas se incluirá todo el catálogo.</p>}
              </div>
            )} />
          )}

          {scope === "products" && (
            <Controller control={control} name="productIds" render={({ field }) => {
              const sel = new Set(field.value ?? []);
              const toggle = (id: string) => field.onChange(sel.has(id) ? field.value.filter((x) => x !== id) : [...(field.value ?? []), id]);
              return (
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, SKU o categoría…" className="h-10 pl-10" aria-label="Buscar productos" />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => field.onChange([...new Set([...(field.value ?? []), ...visible.map((p) => p.id)])])}>Marcar visibles</Button>
                    <Button size="sm" variant="ghost" onClick={() => field.onChange([])}>Limpiar</Button>
                  </div>
                  <p className="mb-2 text-xs text-stone">{sel.size} {pluralize(sel.size, "producto elegido", "productos elegidos")} (máx. 300)</p>
                  <ul className="max-h-64 divide-y divide-neutral-100 overflow-y-auto rounded-xl border border-neutral-200">
                    {visible.length === 0 && <li className="px-4 py-6 text-center text-sm text-stone">No hay productos que coincidan.</li>}
                    {visible.map((p) => (
                      <li key={p.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 hover:bg-brand-tint/30">
                          <input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 accent-[#E65385]" />
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{p.name}</span><span className="block truncate text-xs text-stone">{p.category} · {p.sku}</span></span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  {error?.productIds?.[0] && <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{error.productIds[0]}</p>}
                </div>
              );
            }} />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vence el (opcional)" error={error?.expiresAt?.[0]} hint="Pasada esa fecha el enlace deja de funcionar."><Input type="date" min={limaDateKey(new Date())} {...register("expiresAt")} /></Field>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <Controller control={control} name="showPrices" render={({ field }) => <Switch checked={!!field.value} onChange={field.onChange} label="Mostrar precios" />} />
            <Controller control={control} name="onlyInStock" render={({ field }) => <Switch checked={!!field.value} onChange={field.onChange} label="Solo productos con stock" />} />
            <Controller control={control} name="isActive" render={({ field }) => <Switch checked={!!field.value} onChange={field.onChange} label="Enlace activo" />} />
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" loading={isSubmitting}>Guardar</Button></div>
        </form>
      </Modal>

      <ConfirmDialog open={!!renew} onClose={() => setRenew(null)} loading={busy} title="¿Renovar el enlace?" description="Se generará una dirección nueva. El enlace que ya compartiste dejará de funcionar y tendrás que enviar el nuevo." confirmLabel="Renovar enlace"
        onConfirm={async () => { if (!renew) return; setBusy(true); const r = await regenerateShareLinkAction(renew.id); setBusy(false); if (!r.ok) return toast.error(r.error); toast.success(r.message); setRenew(null); router.refresh(); }} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} loading={busy} danger title={`¿Eliminar «${del?.title}»?`} description="El enlace dejará de funcionar para todos los clientes. Tus productos no se modifican." confirmLabel="Eliminar"
        onConfirm={async () => { if (!del) return; setBusy(true); const r = await deleteShareCatalogAction(del.id); setBusy(false); if (!r.ok) return toast.error(r.error); toast.success(r.message); setDel(null); router.refresh(); }} />
    </>
  );
}
