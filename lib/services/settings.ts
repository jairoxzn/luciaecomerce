import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { cached, cacheKey, invalidateInBackground } from "@/lib/cache";
import { num } from "@/lib/utils";

export type SizeGuideSection = { title: string; headers: string[]; rows: string[][] };

export type Settings = {
  storeName: string;
  slogan: string;
  logoUrl: string | null;
  heroDescription: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  businessHours: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  aboutText: string | null;
  shippingPolicy: string | null;
  returnPolicy: string | null;
  privacyPolicy: string | null;
  termsAndConditions: string | null;
  sizeGuide: SizeGuideSection[];
  pickupEnabled: boolean;
  pickupAddress: string | null;
  pickupPrice: number;
  yapeEnabled: boolean;
  yapeNumber: string | null;
  yapeHolder: string | null;
  yapeQrUrl: string | null;
  plinEnabled: boolean;
  plinNumber: string | null;
  plinHolder: string | null;
  plinQrUrl: string | null;
  transferEnabled: boolean;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankCci: string | null;
  bankHolder: string | null;
  codEnabled: boolean;
  paymentInstructions: string | null;
  defaultMinStock: number;
  whatsappNotificationsEnabled: boolean;
};

export const SETTINGS_TAG = "settings";

const loadSettings = unstable_cache(
  () =>
    cached(cacheKey("settings"), 300, async (): Promise<Settings> => {
      const row = await prisma.storeSettings.upsert({ where: { id: "main" }, update: {}, create: { id: "main" } });
      const { id: _id, updatedAt: _u, pickupPrice, sizeGuide, ...rest } = row;
      void _id;
      void _u;
      return {
        ...rest,
        pickupPrice: num(pickupPrice),
        sizeGuide: Array.isArray(sizeGuide) ? (sizeGuide as SizeGuideSection[]) : [],
      };
    }),
  ["store-settings"],
  { tags: [SETTINGS_TAG], revalidate: 300 },
);

/** Una sola consulta por petición aunque varios componentes la pidan a la vez. */
export const getSettings = cache(() => loadSettings());

export function revalidateSettings() {
  revalidateTag(SETTINGS_TAG);
  invalidateInBackground("settings");
}

/** Métodos de pago habilitados con su configuración (sin exponer nada sensible: son datos para el cliente). */
export function enabledPaymentMethods(s: Settings) {
  return {
    YAPE: s.yapeEnabled && !!s.yapeNumber,
    PLIN: s.plinEnabled && !!s.plinNumber,
    TRANSFER: s.transferEnabled && !!s.bankAccountNumber,
    COD: s.codEnabled,
  } as const;
}
