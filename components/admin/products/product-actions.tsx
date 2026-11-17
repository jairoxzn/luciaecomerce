"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProductAction, setProductStatusAction } from "@/app/admin/actions/products";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";

export function ProductActions({ id, status, slug }: { id: string; status: "DRAFT" | "ACTIVE" | "ARCHIVED"; slug: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);

  async function exec(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return toast.error(r.error ?? "Error");
    toast.success(r.message ?? "Listo");
    setConfirm(null);
    after ? after() : router.refresh();
  }

  return (
    <>
      {status === "ACTIVE" && <LinkButton href={`/productos/${slug}`} target="_blank" variant="outline" size="sm"><ExternalLink className="h-4 w-4" /> Ver en tienda</LinkButton>}
      {status === "ARCHIVED" ? (
        <Button variant="soft" size="sm" onClick={() => exec(() => setProductStatusAction(id, "ACTIVE"))}><ArchiveRestore className="h-4 w-4" /> Restaurar</Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setConfirm("archive")}><Archive className="h-4 w-4" /> Archivar</Button>
      )}
      <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-600" onClick={() => setConfirm("delete")}><Trash2 className="h-4 w-4" /> Eliminar</Button>
      <ConfirmDialog open={confirm === "archive"} onClose={() => setConfirm(null)} loading={busy} title="¿Archivar producto?" description="Dejará de mostrarse en la tienda, pero conservará su historial de ventas." confirmLabel="Archivar" onConfirm={() => exec(() => setProductStatusAction(id, "ARCHIVED"))} />
      <ConfirmDialog open={confirm === "delete"} onClose={() => setConfirm(null)} loading={busy} danger title="¿Eliminar definitivamente?" description="Solo es posible si el producto nunca se vendió. Se borrarán sus fotos y variantes." confirmLabel="Eliminar" onConfirm={() => exec(() => deleteProductAction(id), () => router.push("/admin/productos"))} />
    </>
  );
}

export function BackToList() {
  return <Link href="/admin/productos" className="text-sm text-stone hover:text-brand">← Productos</Link>;
}
