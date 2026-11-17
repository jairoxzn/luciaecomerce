import { prisma } from "@/lib/prisma";
import { PERU_DEPARTMENTS } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth/session";
import { enabledPaymentMethods, getSettings } from "@/lib/services/settings";
import type { CheckoutConfig, PaymentOption } from "@/components/checkout/types";

export function buildPaymentOptions(s: Awaited<ReturnType<typeof getSettings>>): PaymentOption[] {
  const en = enabledPaymentMethods(s);
  const out: PaymentOption[] = [];
  if (en.YAPE) out.push({ method: "YAPE", label: "Yape", hint: "Paga desde tu app y sube la captura del comprobante.", number: s.yapeNumber, holder: s.yapeHolder, qrUrl: s.yapeQrUrl });
  if (en.PLIN) out.push({ method: "PLIN", label: "Plin", hint: "Paga desde tu app y sube la captura del comprobante.", number: s.plinNumber, holder: s.plinHolder, qrUrl: s.plinQrUrl });
  if (en.TRANSFER) out.push({ method: "TRANSFER", label: "Transferencia bancaria", hint: "Transfiere a nuestra cuenta y sube el comprobante.", bankName: s.bankName, bankAccountNumber: s.bankAccountNumber, bankCci: s.bankCci, holder: s.bankHolder });
  if (en.COD) out.push({ method: "COD", label: "Contra entrega", hint: "Paga en efectivo cuando recibas tu pedido." });
  return out;
}

export async function getCheckoutConfig(): Promise<CheckoutConfig> {
  const [settings, user, zones] = await Promise.all([getSettings(), getCurrentUser(), prisma.shippingZone.findMany({ where: { isActive: true }, select: { departments: true } })]);
  const covered = new Set(zones.flatMap((z) => z.departments));
  const departments = PERU_DEPARTMENTS.filter((d) => covered.has(d));

  let prefill: CheckoutConfig["prefill"] = null;
  let addresses: CheckoutConfig["addresses"] = [];
  if (user) {
    const [profile, addrs] = await Promise.all([
      prisma.customerProfile.findUnique({ where: { userId: user.id } }),
      prisma.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
    ]);
    const [fn, ...ln] = user.name.split(" ");
    prefill = { firstName: profile?.firstName ?? fn, lastName: profile?.lastName ?? ln.join(" "), email: user.email, phone: profile?.phone ?? "", dni: profile?.dni ?? "" };
    addresses = addrs.map((a) => ({ id: a.id, label: a.label, recipient: a.recipient, phone: a.phone, department: a.department, province: a.province, district: a.district, line: a.line, reference: a.reference, isDefault: a.isDefault }));
  }

  return {
    pickupEnabled: settings.pickupEnabled,
    pickupAddress: settings.pickupAddress,
    pickupPrice: settings.pickupPrice,
    payments: buildPaymentOptions(settings),
    paymentInstructions: settings.paymentInstructions,
    departments: departments.length ? [...departments] : [...PERU_DEPARTMENTS],
    prefill,
    addresses,
    authenticated: !!user,
  };
}
