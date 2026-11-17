"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, CreditCard, MapPin, ShoppingBag, Store, Truck, User as UserIcon, ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { placeOrderAction } from "@/app/actions/checkout";
import { useCart } from "@/hooks/use-cart";
import { useCartQuote } from "@/hooks/use-cart-quote";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CartLineItem } from "@/components/cart/cart-line";
import { CartSummary } from "@/components/cart/cart-summary";
import { CouponBox } from "@/components/cart/coupon-box";
import { cn, formatPEN } from "@/lib/utils";
import { placeOrderSchema, type PlaceOrderFormInput } from "@/lib/validations/checkout";
import { PaymentDetails } from "./payment-details";
import type { CheckoutConfig } from "./types";

const STEPS = [
  { id: "cliente", label: "Cliente", Icon: UserIcon },
  { id: "direccion", label: "Dirección", Icon: MapPin },
  { id: "entrega", label: "Entrega", Icon: Truck },
  { id: "pago", label: "Pago", Icon: CreditCard },
  { id: "resumen", label: "Resumen", Icon: ClipboardList },
] as const;

const STEP_FIELDS: Record<number, (keyof PlaceOrderFormInput | `customer.${string}` | `delivery.${string}`)[]> = {
  0: ["customer.firstName", "customer.lastName", "customer.dni", "customer.phone", "customer.email"],
  1: ["delivery.department", "delivery.province", "delivery.district", "delivery.addressLine", "delivery.reference"],
  2: ["delivery.method"],
  3: ["paymentMethod"],
};

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function CheckoutForm({ config }: { config: CheckoutConfig }) {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const couponCode = useCart((s) => s.couponCode);
  const clearCart = useCart((s) => s.clear);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const keyRef = useRef<string>("");
  const done = useRef(false);

  // Clave de idempotencia estable durante el checkout (evita pedidos duplicados por doble clic o reintento)
  useEffect(() => {
    try {
      keyRef.current = sessionStorage.getItem("lj-idem") || newKey();
      sessionStorage.setItem("lj-idem", keyRef.current);
    } catch {
      keyRef.current = newKey();
    }
  }, []);

  const defaultAddr = config.addresses.find((a) => a.isDefault) ?? config.addresses[0];
  const form = useForm<PlaceOrderFormInput>({
    resolver: zodResolver(placeOrderSchema) as never,
    mode: "onTouched",
    defaultValues: {
      idempotencyKey: "x".repeat(16),
      items: [],
      customer: { firstName: config.prefill?.firstName ?? "", lastName: config.prefill?.lastName ?? "", dni: config.prefill?.dni ?? "", phone: config.prefill?.phone ?? "", email: config.prefill?.email ?? "" },
      delivery: {
        method: "DELIVERY",
        department: defaultAddr?.department ?? "",
        province: defaultAddr?.province ?? "",
        district: defaultAddr?.district ?? "",
        addressLine: defaultAddr?.line ?? "",
        reference: defaultAddr?.reference ?? "",
      },
      paymentMethod: config.payments[0]?.method ?? "COD",
      customerNote: "",
    },
  });
  const { register, control, setValue, trigger, formState: { errors }, handleSubmit, getValues } = form;
  const method = useWatch({ control, name: "delivery.method" });
  const department = useWatch({ control, name: "delivery.department" });
  const payment = useWatch({ control, name: "paymentMethod" });

  const { quote, loading, empty, hydrated } = useCartQuote({ delivery: { method, department: method === "DELIVERY" ? department : null } });
  const paymentOption = config.payments.find((p) => p.method === payment);
  const allowedPayments = useMemo(() => config.payments.filter((p) => !(p.method === "COD" && method === "PICKUP")), [config.payments, method]);

  useEffect(() => {
    if (!allowedPayments.some((p) => p.method === payment) && allowedPayments[0]) setValue("paymentMethod", allowedPayments[0].method);
  }, [allowedPayments, payment, setValue]);

  useEffect(() => {
    if (empty && !done.current) toast.info("Tu carrito está vacío");
  }, [empty]);

  // Mantiene los valores técnicos del formulario sincronizados (se revalidan en servidor al enviar)
  useEffect(() => {
    setValue("items", items);
    setValue("idempotencyKey", keyRef.current.length >= 16 ? keyRef.current : "x".repeat(16));
  }, [items, setValue]);

  async function next() {
    const fields = STEP_FIELDS[step];
    // Dirección solo es obligatoria para envío a domicilio
    const toCheck = step === 1 && method === "PICKUP" ? [] : fields;
    const ok = toCheck.length ? await trigger(toCheck as never) : true;
    if (!ok) return toast.error("Revisa los campos marcados.");
    if (step === 2 && method === "DELIVERY") {
      const dep = getValues("delivery.department");
      if (!dep || !(await trigger(STEP_FIELDS[1] as never))) {
        setStep(1);
        return toast.error("Completa la dirección de envío.");
      }
      if (quote?.shippingError) return toast.error(quote.shippingError);
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(values: PlaceOrderFormInput) {
    if (done.current || submitting) return;
    if (!quote || quote.hasBlockingIssues) return toast.error("Revisa tu carrito: hay productos no disponibles.");
    setSubmitting(true);
    setServerError(null);
    const res = await placeOrderAction({
      ...values,
      idempotencyKey: keyRef.current,
      items,
      couponCode: couponCode ?? undefined,
      delivery: { ...values.delivery, ...(values.delivery.method === "PICKUP" ? { department: undefined, province: undefined, district: undefined, addressLine: undefined } : {}) },
    });
    if (!res.ok) {
      setSubmitting(false);
      setServerError(res.error);
      toast.error(res.error);
      return;
    }
    done.current = true;
    try { sessionStorage.removeItem("lj-idem"); } catch { /* noop */ }
    clearCart();
    toast.success("¡Pedido registrado!");
    router.replace(`/checkout/confirmacion/${res.data!.code}`);
  }

  if (!hydrated) return <Skeleton className="h-96 w-full" />;
  if (empty && !done.current) {
    return <EmptyState icon={ShoppingBag} title="No hay productos para pagar" description="Agrega productos a tu carrito para continuar." action={<LinkButton href="/catalogo">Ir al catálogo</LinkButton>} />;
  }
  if (config.payments.length === 0) {
    return (
      <EmptyState
        icon={CreditCard}
        title="Pagos no disponibles por ahora"
        description="La tienda aún no tiene métodos de pago habilitados. Contáctanos y te ayudaremos a completar tu pedido."
        action={<LinkButton href="/contacto" variant="soft">Contactar a la tienda</LinkButton>}
      />
    );
  }

  const radio = (active: boolean) => cn("flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition", active ? "border-brand bg-brand-tint/50 shadow-soft" : "border-neutral-200 hover:border-brand-soft");

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid items-start gap-8 lg:grid-cols-[1fr_400px]">
      <div>
        {/* Indicador de pasos */}
        <ol className="mb-8 flex items-center justify-between gap-1" aria-label="Progreso del checkout">
          {STEPS.map((s, i) => (
            <li key={s.id} className="flex flex-1 flex-col items-center gap-1.5 text-center">
              <button type="button" disabled={i > step} onClick={() => setStep(i)} aria-current={i === step ? "step" : undefined} className={cn("flex h-11 w-11 items-center justify-center rounded-full border-2 transition", i < step ? "border-brand bg-brand text-white" : i === step ? "border-brand bg-white text-brand shadow-soft" : "border-neutral-200 bg-white text-neutral-400")}>
                {i < step ? <Check className="h-5 w-5" /> : <s.Icon className="h-5 w-5" />}
              </button>
              <span className={cn("hidden text-xs font-medium sm:block", i <= step ? "text-ink" : "text-neutral-400")}>{s.label}</span>
            </li>
          ))}
        </ol>

        <div className="rounded-3xl border border-neutral-100 bg-white p-5 shadow-card sm:p-8">
          {step === 0 && (
            <section className="animate-[fade-up_0.3s_ease-out] space-y-5">
              <h2 className="text-xl font-bold">Información del cliente</h2>
              {!config.authenticated && <p className="rounded-xl bg-brand-tint/60 px-4 py-3 text-sm">¿Ya tienes cuenta? <Link href="/login?next=/checkout" className="font-semibold text-brand underline">Inicia sesión</Link> para autocompletar tus datos y ver tus pedidos.</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombres" error={errors.customer?.firstName?.message}><Input autoComplete="given-name" aria-invalid={!!errors.customer?.firstName} {...register("customer.firstName")} /></Field>
                <Field label="Apellidos" error={errors.customer?.lastName?.message}><Input autoComplete="family-name" aria-invalid={!!errors.customer?.lastName} {...register("customer.lastName")} /></Field>
                <Field label="DNI (opcional)" error={errors.customer?.dni?.message}><Input inputMode="numeric" maxLength={8} autoComplete="off" aria-invalid={!!errors.customer?.dni} {...register("customer.dni")} /></Field>
                <Field label="Teléfono / celular" error={errors.customer?.phone?.message}><Input type="tel" inputMode="tel" autoComplete="tel" placeholder="987654321" aria-invalid={!!errors.customer?.phone} {...register("customer.phone")} /></Field>
                <Field label="Correo electrónico" error={errors.customer?.email?.message} className="sm:col-span-2"><Input type="email" autoComplete="email" aria-invalid={!!errors.customer?.email} {...register("customer.email")} /></Field>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="animate-[fade-up_0.3s_ease-out] space-y-5">
              <h2 className="text-xl font-bold">Dirección de entrega</h2>
              {config.addresses.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Mis direcciones guardadas</p>
                  <div className="flex flex-wrap gap-2">
                    {config.addresses.map((a) => (
                      <button key={a.id} type="button" onClick={() => { setValue("delivery.department", a.department, { shouldValidate: true }); setValue("delivery.province", a.province, { shouldValidate: true }); setValue("delivery.district", a.district, { shouldValidate: true }); setValue("delivery.addressLine", a.line, { shouldValidate: true }); setValue("delivery.reference", a.reference ?? ""); }} className="rounded-full border border-neutral-200 px-4 py-2 text-sm transition hover:border-brand hover:text-brand">
                        {a.label} · {a.district}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Departamento" error={errors.delivery?.department?.message}>
                  <Select aria-invalid={!!errors.delivery?.department} {...register("delivery.department")}>
                    <option value="">Selecciona…</option>
                    {config.departments.map((d) => <option key={d} value={d}>{d}</option>)}
                  </Select>
                </Field>
                <Field label="Provincia" error={errors.delivery?.province?.message}><Input autoComplete="address-level2" aria-invalid={!!errors.delivery?.province} {...register("delivery.province")} /></Field>
                <Field label="Distrito" error={errors.delivery?.district?.message}><Input autoComplete="address-level3" aria-invalid={!!errors.delivery?.district} {...register("delivery.district")} /></Field>
                <Field label="Dirección" error={errors.delivery?.addressLine?.message}><Input autoComplete="street-address" placeholder="Av. / Jr. / Calle y número" aria-invalid={!!errors.delivery?.addressLine} {...register("delivery.addressLine")} /></Field>
                <Field label="Referencia (opcional)" error={errors.delivery?.reference?.message} className="sm:col-span-2"><Input placeholder="Cerca al mall, frente al parque…" {...register("delivery.reference")} /></Field>
              </div>
              {config.pickupEnabled && (
                <button type="button" onClick={() => { setValue("delivery.method", "PICKUP"); setStep(2); }} className="inline-flex items-center gap-2 text-sm font-medium text-brand underline-offset-4 hover:underline">
                  <Store className="h-4 w-4" /> Prefiero recojo en tienda (sin dirección)
                </button>
              )}
            </section>
          )}

          {step === 2 && (
            <section className="animate-[fade-up_0.3s_ease-out] space-y-4">
              <h2 className="text-xl font-bold">Método de entrega</h2>
              <Controller control={control} name="delivery.method" render={({ field }) => (
                <div className="space-y-3" role="radiogroup" aria-label="Método de entrega">
                  <label className={radio(field.value === "DELIVERY")}>
                    <input type="radio" className="mt-1 accent-[#E65385]" checked={field.value === "DELIVERY"} onChange={() => field.onChange("DELIVERY")} />
                    <Truck className="mt-0.5 h-5 w-5 text-brand" />
                    <span className="flex-1">
                      <span className="block font-semibold">Envío a domicilio</span>
                      <span className="text-sm text-stone">{department ? `A ${department}` : "Selecciona tu departamento en el paso anterior"}{quote?.shippingZoneName && field.value === "DELIVERY" ? ` · ${quote.shippingZoneName}` : ""}</span>
                      {field.value === "DELIVERY" && quote?.shippingError && <span className="mt-1 block text-sm font-medium text-red-600">{quote.shippingError}</span>}
                    </span>
                    {field.value === "DELIVERY" && quote?.shippingCents != null && <span className="font-bold">{quote.shippingCents === 0 ? "Gratis" : formatPEN(quote.shippingCents / 100)}</span>}
                  </label>
                  {config.pickupEnabled && (
                    <label className={radio(field.value === "PICKUP")}>
                      <input type="radio" className="mt-1 accent-[#E65385]" checked={field.value === "PICKUP"} onChange={() => field.onChange("PICKUP")} />
                      <Store className="mt-0.5 h-5 w-5 text-brand" />
                      <span className="flex-1">
                        <span className="block font-semibold">Recojo en tienda</span>
                        <span className="text-sm text-stone">{config.pickupAddress ?? "Te indicaremos la dirección al confirmar."}</span>
                      </span>
                      <span className="font-bold">{config.pickupPrice === 0 ? "Gratis" : formatPEN(config.pickupPrice)}</span>
                    </label>
                  )}
                </div>
              )} />
              <Field label="Notas para tu pedido (opcional)" error={errors.customerNote?.message}><Textarea rows={3} maxLength={300} placeholder="Indicaciones de entrega, horario preferido…" {...register("customerNote")} /></Field>
            </section>
          )}

          {step === 3 && (
            <section className="animate-[fade-up_0.3s_ease-out] space-y-4">
              <h2 className="text-xl font-bold">Método de pago</h2>
              <Controller control={control} name="paymentMethod" render={({ field }) => (
                <div className="space-y-3" role="radiogroup" aria-label="Método de pago">
                  {allowedPayments.map((p) => (
                    <label key={p.method} className={radio(field.value === p.method)}>
                      <input type="radio" className="mt-1 accent-[#E65385]" checked={field.value === p.method} onChange={() => field.onChange(p.method)} />
                      <span className="flex-1"><span className="block font-semibold">{p.label}</span><span className="text-sm text-stone">{p.hint}</span></span>
                    </label>
                  ))}
                </div>
              )} />
              {paymentOption && <PaymentDetails option={paymentOption} instructions={config.paymentInstructions} amount={quote ? formatPEN(quote.totalCents / 100) : undefined} />}
              {paymentOption && paymentOption.method !== "COD" && <p className="text-xs text-stone">Al confirmar el pedido podrás subir tu comprobante de pago. El pedido se confirma cuando validamos tu pago.</p>}
            </section>
          )}

          {step === 4 && (
            <section className="animate-[fade-up_0.3s_ease-out] space-y-5">
              <h2 className="text-xl font-bold">Resumen y confirmación</h2>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-2xl bg-mist p-4"><p className="mb-1 font-semibold">Cliente</p><p>{getValues("customer.firstName")} {getValues("customer.lastName")}</p><p className="text-stone">{getValues("customer.email")} · {getValues("customer.phone")}</p></div>
                <div className="rounded-2xl bg-mist p-4"><p className="mb-1 font-semibold">{method === "PICKUP" ? "Recojo en tienda" : "Envío a domicilio"}</p>{method === "PICKUP" ? <p className="text-stone">{config.pickupAddress}</p> : <p className="text-stone">{getValues("delivery.addressLine")}, {getValues("delivery.district")}, {getValues("delivery.province")}, {department}</p>}</div>
                <div className="rounded-2xl bg-mist p-4 sm:col-span-2"><p className="mb-1 font-semibold">Pago</p><p className="text-stone">{paymentOption?.label}</p></div>
              </div>
              {serverError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{serverError}</p>}
              <p className="text-xs text-stone">Al confirmar aceptas los <Link href="/politicas/terminos" className="underline" target="_blank">términos y condiciones</Link> y la <Link href="/politicas/privacidad" className="underline" target="_blank">política de privacidad</Link>.</p>
            </section>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} disabled={submitting}><ArrowLeft className="h-4 w-4" /> Atrás</Button>
            ) : (
              <Link href="/carrito" className="text-sm font-medium text-stone hover:text-brand">← Volver al carrito</Link>
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" size="lg" onClick={next}>Continuar <ArrowRight className="h-4 w-4" /></Button>
            ) : (
              <Button type="submit" size="lg" loading={submitting} disabled={!quote || quote.hasBlockingIssues || quote.shippingCents === null}>
                Confirmar pedido {quote && `· ${formatPEN(quote.totalCents / 100)}`}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Resumen lateral (importes calculados por el servidor) */}
      <aside className="space-y-4 rounded-3xl border border-neutral-100 bg-white p-5 shadow-card sm:p-6 lg:sticky lg:top-28">
        <h2 className="text-lg font-bold">Tu pedido</h2>
        {!quote ? (
          <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
        ) : (
          <>
            <ul className="space-y-2.5">{quote.lines.map((l) => <CartLineItem key={l.variantId} line={l} compact readOnly />)}</ul>
            <CouponBox quote={quote} />
            <div className={loading ? "opacity-60 transition" : "transition"}><CartSummary quote={quote} shippingNote="Elige la entrega" /></div>
            {loading && <p className="flex items-center gap-2 text-xs text-stone"><Loader2 className="h-3 w-3 animate-spin" /> Actualizando importes…</p>}
          </>
        )}
      </aside>
    </form>
  );
}
