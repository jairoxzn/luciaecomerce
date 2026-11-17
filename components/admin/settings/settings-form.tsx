"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveSettingsAction } from "@/app/admin/actions/settings";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch, Textarea } from "@/components/ui/input";
import { Card } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/image-upload";
import { cn } from "@/lib/utils";
import type { Settings } from "@/lib/services/settings";

type Guide = { title: string; headers: string; rows: string };
type F = Omit<Settings, "sizeGuide" | "pickupPrice"> & { pickupPrice: number };

const TABS = [
  ["general", "General y marca"], ["contacto", "Contacto y redes"], ["pagos", "Pagos"], ["entrega", "Entrega"], ["inventario", "Inventario y avisos"], ["textos", "Políticas y textos"], ["tallas", "Guía de tallas"],
] as const;

const s = (v: string | null | undefined) => v ?? "";

export function SettingsForm({ settings, whatsappEnv }: { settings: Settings; whatsappEnv: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("general");
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);
  const [guide, setGuide] = useState<Guide[]>(settings.sizeGuide.map((g) => ({ title: g.title, headers: g.headers.join(", "), rows: g.rows.map((r) => r.join(", ")).join("\n") })));
  const { register, control, handleSubmit, formState: { isSubmitting, isDirty } } = useForm<F>({
    defaultValues: { ...settings, phone: s(settings.phone), whatsapp: s(settings.whatsapp), email: s(settings.email), address: s(settings.address), businessHours: s(settings.businessHours), instagramUrl: s(settings.instagramUrl), facebookUrl: s(settings.facebookUrl), tiktokUrl: s(settings.tiktokUrl), aboutText: s(settings.aboutText), shippingPolicy: s(settings.shippingPolicy), returnPolicy: s(settings.returnPolicy), privacyPolicy: s(settings.privacyPolicy), termsAndConditions: s(settings.termsAndConditions), pickupAddress: s(settings.pickupAddress), yapeNumber: s(settings.yapeNumber), yapeHolder: s(settings.yapeHolder), plinNumber: s(settings.plinNumber), plinHolder: s(settings.plinHolder), bankName: s(settings.bankName), bankAccountNumber: s(settings.bankAccountNumber), bankCci: s(settings.bankCci), bankHolder: s(settings.bankHolder), paymentInstructions: s(settings.paymentInstructions) },
  });

  const err = (k: string) => errors?.[k]?.[0];
  const toggleRow = "flex flex-wrap items-center justify-between gap-3 rounded-xl bg-mist px-4 py-3";

  return (
    <form noValidate onSubmit={handleSubmit(async (v) => {
      const sizeGuide = guide.filter((g) => g.title.trim()).map((g) => {
        const headers = g.headers.split(",").map((x) => x.trim()).filter(Boolean);
        return { title: g.title.trim(), headers, rows: g.rows.split("\n").map((l) => l.split(",").map((x) => x.trim())).filter((r) => r.some(Boolean)) };
      });
      const r = await saveSettingsAction({ ...v, pickupPrice: Number(v.pickupPrice), defaultMinStock: Number(v.defaultMinStock), sizeGuide } as never);
      if (!r.ok) { setErrors(r.fieldErrors ?? null); return toast.error(r.error); }
      setErrors(null); toast.success(r.message); router.refresh();
    })}>
      <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto">
        {TABS.map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-medium transition", tab === k ? "bg-ink text-white" : "bg-white text-stone ring-1 ring-neutral-200 hover:text-ink")}>{l}</button>)}
      </div>

      <div className="space-y-6">
        <div hidden={tab !== "general"} className="space-y-6">
          <Card title="Identidad de la tienda">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre comercial" error={err("storeName")}><Input {...register("storeName")} /></Field>
              <Field label="Eslogan" error={err("slogan")}><Input {...register("slogan")} /></Field>
              <Field label="Descripción del banner principal" error={err("heroDescription")} className="sm:col-span-2"><Input {...register("heroDescription")} /></Field>
            </div>
            <div className="mt-5"><Controller control={control} name="logoUrl" render={({ field }) => <ImageField label="Logotipo (opcional)" folder="branding" value={field.value} onChange={field.onChange} aspect="aspect-[3/1]" hint="Si lo dejas vacío se usa el logotipo original de LUCIA JEANS. Usa un PNG/WebP con fondo transparente en color rosa." />} /></div>
          </Card>
        </div>

        <div hidden={tab !== "contacto"} className="space-y-6">
          <Card title="Datos de contacto">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Teléfono" error={err("phone")}><Input {...register("phone")} /></Field>
              <Field label="WhatsApp" hint="Solo número (ej. 933614207). Activa el botón flotante y los enlaces." error={err("whatsapp")}><Input {...register("whatsapp")} /></Field>
              <Field label="Correo" error={err("email")}><Input type="email" {...register("email")} /></Field>
              <Field label="Horario de atención" error={err("businessHours")}><Input {...register("businessHours")} /></Field>
              <Field label="Dirección" error={err("address")} className="sm:col-span-2"><Input {...register("address")} /></Field>
            </div>
          </Card>
          <Card title="Redes sociales">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Instagram (URL)" error={err("instagramUrl")}><Input placeholder="https://instagram.com/…" {...register("instagramUrl")} /></Field>
              <Field label="Facebook (URL)" error={err("facebookUrl")}><Input placeholder="https://facebook.com/…" {...register("facebookUrl")} /></Field>
              <Field label="TikTok (URL)" error={err("tiktokUrl")}><Input placeholder="https://tiktok.com/@…" {...register("tiktokUrl")} /></Field>
            </div>
          </Card>
        </div>

        <div hidden={tab !== "pagos"} className="space-y-6">
          <Card title="Yape">
            <div className="space-y-4">
              <div className={toggleRow}><span className="text-sm font-medium">Aceptar pagos con Yape</span><Controller control={control} name="yapeEnabled" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Activo" />} /></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Número de Yape" error={err("yapeNumber")}><Input {...register("yapeNumber")} /></Field><Field label="Nombre del titular" error={err("yapeHolder")}><Input {...register("yapeHolder")} /></Field></div>
              <Controller control={control} name="yapeQrUrl" render={({ field }) => <ImageField label="Código QR de Yape" folder="branding" value={field.value} onChange={field.onChange} aspect="aspect-square" />} />
            </div>
          </Card>
          <Card title="Plin">
            <div className="space-y-4">
              <div className={toggleRow}><span className="text-sm font-medium">Aceptar pagos con Plin</span><Controller control={control} name="plinEnabled" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Activo" />} /></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Número de Plin" error={err("plinNumber")}><Input {...register("plinNumber")} /></Field><Field label="Nombre del titular" error={err("plinHolder")}><Input {...register("plinHolder")} /></Field></div>
              <Controller control={control} name="plinQrUrl" render={({ field }) => <ImageField label="Código QR de Plin" folder="branding" value={field.value} onChange={field.onChange} aspect="aspect-square" />} />
            </div>
          </Card>
          <Card title="Transferencia bancaria">
            <div className="space-y-4">
              <div className={toggleRow}><span className="text-sm font-medium">Aceptar transferencias</span><Controller control={control} name="transferEnabled" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Activo" />} /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Banco"><Input {...register("bankName")} /></Field><Field label="Titular de la cuenta"><Input {...register("bankHolder")} /></Field>
                <Field label="N.° de cuenta" error={err("bankAccountNumber")}><Input {...register("bankAccountNumber")} /></Field><Field label="CCI"><Input {...register("bankCci")} /></Field>
              </div>
            </div>
          </Card>
          <Card title="Contra entrega e instrucciones">
            <div className="space-y-4">
              <div className={toggleRow}><span className="text-sm font-medium">Habilitar pago contra entrega (solo envíos a domicilio)</span><Controller control={control} name="codEnabled" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Activo" />} /></div>
              <Field label="Instrucciones de pago (se muestran al cliente)"><Textarea rows={3} maxLength={1000} {...register("paymentInstructions")} /></Field>
            </div>
          </Card>
        </div>

        <div hidden={tab !== "entrega"} className="space-y-6">
          <Card title="Recojo en tienda">
            <div className="space-y-4">
              <div className={toggleRow}><span className="text-sm font-medium">Permitir recojo en tienda</span><Controller control={control} name="pickupEnabled" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Activo" />} /></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field label="Dirección de recojo"><Input {...register("pickupAddress")} /></Field><Field label="Costo (S/)" error={err("pickupPrice")}><Input type="number" step="0.01" min={0} {...register("pickupPrice", { valueAsNumber: true })} /></Field></div>
              <p className="text-xs text-stone">Los costos del envío a domicilio se configuran por zona en la sección «Zonas de entrega» más abajo.</p>
            </div>
          </Card>
        </div>

        <div hidden={tab !== "inventario"} className="space-y-6">
          <Card title="Inventario">
            <Field label="Stock mínimo por defecto (para nuevas variantes)" className="max-w-xs"><Input type="number" min={0} {...register("defaultMinStock", { valueAsNumber: true })} /></Field>
          </Card>
          <Card title="Avisos por WhatsApp a clientes">
            <div className="space-y-4">
              <div className={toggleRow}><span className="text-sm font-medium">Enviar avisos automáticos por WhatsApp</span><Controller control={control} name="whatsappNotificationsEnabled" render={({ field }) => <Switch checked={field.value} onChange={field.onChange} label="Activo" />} /></div>
              <p className={cn("rounded-xl px-4 py-3 text-sm", whatsappEnv ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-900")}>{whatsappEnv ? "Credenciales de WhatsApp Cloud API detectadas en el servidor." : "Faltan las variables WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_ACCESS_TOKEN en el servidor. Mientras tanto, los avisos quedan registrados como «no enviados» y puedes enviarlos manualmente desde Notificaciones."}</p>
            </div>
          </Card>
        </div>

        <div hidden={tab !== "textos"} className="space-y-6">
          <Card title="Contenido de la tienda">
            <div className="space-y-4">
              <Field label="Nosotros"><Textarea rows={5} {...register("aboutText")} /></Field>
              <Field label="Política de envíos"><Textarea rows={5} {...register("shippingPolicy")} /></Field>
              <Field label="Cambios y devoluciones"><Textarea rows={5} {...register("returnPolicy")} /></Field>
              <Field label="Política de privacidad"><Textarea rows={6} {...register("privacyPolicy")} /></Field>
              <Field label="Términos y condiciones"><Textarea rows={6} {...register("termsAndConditions")} /></Field>
            </div>
          </Card>
        </div>

        <div hidden={tab !== "tallas"} className="space-y-6">
          <Card title="Guía de tallas" action={<Button type="button" size="sm" variant="outline" onClick={() => setGuide([...guide, { title: "", headers: "Talla, Medida", rows: "" }])}><Plus className="h-4 w-4" /> Agregar tabla</Button>}>
            <div className="space-y-5">
              {guide.length === 0 && <p className="text-sm text-stone">Sin tablas. Agrega una para que se muestre en la ficha de producto.</p>}
              {guide.map((g, i) => (
                <div key={i} className="space-y-3 rounded-2xl border border-neutral-200 p-4">
                  <div className="flex gap-2"><Input placeholder="Título (ej. Mujer · Jeans)" value={g.title} onChange={(e) => setGuide(guide.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} /><Button type="button" variant="ghost" className="text-red-600" onClick={() => setGuide(guide.filter((_, j) => j !== i))} aria-label="Eliminar tabla"><Trash2 className="h-4 w-4" /></Button></div>
                  <Field label="Columnas (separadas por coma)"><Input value={g.headers} onChange={(e) => setGuide(guide.map((x, j) => (j === i ? { ...x, headers: e.target.value } : x)))} /></Field>
                  <Field label="Filas (una por línea, valores separados por coma)"><Textarea rows={5} value={g.rows} onChange={(e) => setGuide(guide.map((x, j) => (j === i ? { ...x, rows: e.target.value } : x)))} className="font-mono text-xs" /></Field>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-4 mt-6 flex items-center justify-end gap-3 rounded-2xl border border-neutral-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <span className="text-sm text-stone">{isDirty ? "Tienes cambios sin guardar" : "Todo guardado"}</span>
        <Button type="submit" size="lg" loading={isSubmitting}>Guardar configuración</Button>
      </div>
    </form>
  );
}
