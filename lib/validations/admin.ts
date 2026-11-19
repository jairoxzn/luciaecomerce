import { z } from "zod";
import { idField, moneyField, optionalText } from "./common";

const text = (label: string, min = 2, max = 120) => z.string({ error: `${label} es obligatorio` }).trim().min(min, `${label}: mínimo ${min} caracteres`).max(max, `${label}: máximo ${max} caracteres`);
const nullableMoney = z.number().min(0, "No puede ser negativo").max(1_000_000).nullable().optional();
// Fechas de formulario (YYYY-MM-DD) interpretadas en hora de Lima: inicio = 00:00, fin = 23:59:59
const dateStr = z.string().optional().transform((v) => (v ? new Date(`${v}T00:00:00-05:00`) : null)).refine((d) => d === null || !Number.isNaN(d.getTime()), "Fecha inválida");
const endDateStr = z.string().optional().transform((v) => (v ? new Date(`${v}T23:59:59.999-05:00`) : null)).refine((d) => d === null || !Number.isNaN(d.getTime()), "Fecha inválida");

// ───────── Productos ─────────
export const productSchema = z
  .object({
    name: text("El nombre", 3, 120),
    sku: z.string().trim().max(40).optional().transform((v) => (v ? v.toUpperCase() : undefined)),
    description: z.string().trim().max(4000, "Máximo 4000 caracteres"),
    material: optionalText(200),
    careInstructions: optionalText(400),
    categoryId: idField,
    subcategoryId: z.string().max(40).optional().transform((v) => v || null),
    price: moneyField("El precio").min(0.01, "El precio debe ser mayor a 0"),
    salePrice: z.number().min(0).max(1_000_000).nullable().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
    isFeatured: z.boolean(),
    isBestSeller: z.boolean(),
    isNew: z.boolean(),
  })
  .refine((d) => d.salePrice == null || d.salePrice < d.price, { path: ["salePrice"], message: "El precio de oferta debe ser menor al precio regular" });
export type ProductInput = z.input<typeof productSchema>;

export const generateVariantsSchema = z.object({
  productId: idField,
  sizeIds: z.array(idField).min(1, "Elige al menos una talla"),
  colorIds: z.array(idField).min(1, "Elige al menos un color"),
  stock: z.number().int().min(0).max(100000),
  minStock: z.number().int().min(0).max(10000),
});

export type GenerateVariantsInput = z.input<typeof generateVariantsSchema>;

export const variantUpdateSchema = z.object({
  id: idField,
  stock: z.number().int().min(0, "El stock no puede ser negativo").max(100000),
  minStock: z.number().int().min(0).max(10000),
  price: nullableMoney,
  isActive: z.boolean(),
});

export type VariantUpdateInput = z.input<typeof variantUpdateSchema>;

// ───────── Catálogo ─────────
export const categorySchema = z.object({
  id: z.string().optional(),
  name: text("El nombre", 2, 60),
  description: optionalText(300),
  imageUrl: z.string().max(500).nullish().transform((v) => v || null),
  sortOrder: z.number().int().min(0).max(999),
  isActive: z.boolean(),
  showOnHome: z.boolean(),
});
export const subcategorySchema = z.object({ id: z.string().optional(), categoryId: idField, name: text("El nombre", 2, 60), sortOrder: z.number().int().min(0).max(999), isActive: z.boolean() });
export const sizeSchema = z.object({ name: text("La talla", 1, 12), sortOrder: z.number().int().min(0).max(999) });
export const colorSchema = z.object({ name: text("El color", 2, 30), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color hexadecimal inválido (ej. #E65385)") });

// ───────── Marketing ─────────
export const couponSchema = z
  .object({
    id: z.string().optional(),
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, "Código: 3-30 caracteres (letras, números, - o _)"),
    description: optionalText(200),
    discountType: z.enum(["PERCENT", "FIXED"]),
    value: z.number().min(0.01, "El valor debe ser mayor a 0").max(100000),
    minPurchase: nullableMoney,
    startsAt: dateStr,
    expiresAt: endDateStr,
    usageLimit: z.number().int().min(1).max(1_000_000).nullable().optional(),
    categoryIds: z.array(idField).default([]),
    isPublic: z.boolean(),
    isActive: z.boolean(),
  })
  .refine((d) => d.discountType !== "PERCENT" || d.value <= 100, { path: ["value"], message: "El porcentaje no puede superar 100" })
  .refine((d) => !d.startsAt || !d.expiresAt || d.expiresAt > d.startsAt, { path: ["expiresAt"], message: "El vencimiento debe ser posterior al inicio" });
export type CouponInput = z.input<typeof couponSchema>;

export const promotionSchema = z
  .object({
    id: z.string().optional(),
    name: text("El nombre", 3, 80),
    description: optionalText(200),
    discountType: z.enum(["PERCENT", "FIXED"]),
    value: z.number().min(0.01, "El valor debe ser mayor a 0").max(100000),
    categoryId: z.string().max(40).optional().transform((v) => v || null),
    startsAt: dateStr,
    endsAt: endDateStr,
    isActive: z.boolean(),
  })
  .refine((d) => d.discountType !== "PERCENT" || d.value <= 100, { path: ["value"], message: "El porcentaje no puede superar 100" })
  .refine((d) => !d.startsAt || !d.endsAt || d.endsAt > d.startsAt, { path: ["endsAt"], message: "El fin debe ser posterior al inicio" });
export type PromotionInput = z.input<typeof promotionSchema>;

export const bannerSchema = z.object({
  id: z.string().optional(),
  title: text("El título", 2, 100),
  subtitle: optionalText(200),
  ctaLabel: optionalText(40),
  ctaHref: z.string().trim().max(300).optional().transform((v) => v || null).refine((v) => v === null || v.startsWith("/") || /^https?:\/\//.test(v), "El enlace debe empezar con / o https://"),
  imageUrl: z.string().min(1, "Sube una imagen").max(500),
  mobileImageUrl: z.string().max(500).nullish().transform((v) => v || null),
  position: z.enum(["HERO", "PROMO", "COLLECTION"]),
  sortOrder: z.number().int().min(0).max(999),
  isActive: z.boolean(),
  startsAt: dateStr,
  endsAt: endDateStr,
});
export type BannerInput = z.input<typeof bannerSchema>;

// ───────── Catálogo compartible ─────────
export const shareCatalogSchema = z
  .object({
    id: z.string().optional(),
    title: text("El título", 3, 80),
    message: optionalText(400),
    categoryIds: z.array(idField).max(100).default([]),
    productIds: z.array(idField).max(300, "Máximo 300 productos por catálogo").default([]),
    showPrices: z.boolean(),
    onlyInStock: z.boolean(),
    isActive: z.boolean(),
    expiresAt: endDateStr,
  })
  .refine((d) => !d.expiresAt || d.expiresAt.getTime() > Date.now(), { path: ["expiresAt"], message: "La fecha de vencimiento debe ser futura" });
export type ShareCatalogInput = z.input<typeof shareCatalogSchema>;

// ───────── Operación ─────────
export const inventoryAdjustSchema = z.object({
  variantId: idField,
  mode: z.enum(["ENTRADA", "SALIDA", "AJUSTE"]),
  quantity: z.number().int().min(0, "La cantidad no puede ser negativa").max(100000),
  reason: z.string().trim().min(3, "Indica el motivo (mínimo 3 caracteres)").max(200),
});
export type InventoryAdjustInput = z.input<typeof inventoryAdjustSchema>;

export const orderStatusSchema = z.object({
  orderId: idField,
  status: z.enum(["PENDIENTE", "PAGO_EN_REVISION", "PAGO_CONFIRMADO", "PREPARANDO", "LISTO_PARA_ENTREGA", "EN_CAMINO", "ENTREGADO", "CANCELADO"]),
  note: optionalText(300),
});

export const shippingZoneSchema = z.object({
  id: z.string().optional(),
  name: text("El nombre", 2, 60),
  departments: z.array(z.string().max(40)).min(1, "Selecciona al menos un departamento"),
  price: moneyField("El costo"),
  freeShippingFrom: nullableMoney,
  estimatedDays: optionalText(60),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
});
export type ShippingZoneInput = z.input<typeof shippingZoneSchema>;

const urlOrNull = z.string().trim().max(300).optional().transform((v) => v || null).refine((v) => v === null || /^https?:\/\//.test(v), "Debe empezar con https://");
const digitsPhone = z.string().trim().max(20).optional().transform((v) => v || null);

export const settingsSchema = z.object({
  storeName: text("El nombre comercial", 2, 60),
  slogan: text("El eslogan", 2, 160),
  heroDescription: text("La descripción", 2, 250),
  logoUrl: z.string().max(500).nullish().transform((v) => v || null),
  phone: digitsPhone,
  whatsapp: digitsPhone,
  email: z.string().trim().max(120).optional().transform((v) => v || null).refine((v) => v === null || /^\S+@\S+\.\S+$/.test(v), "Correo inválido"),
  address: optionalText(200).transform((v) => v ?? null),
  businessHours: optionalText(120).transform((v) => v ?? null),
  instagramUrl: urlOrNull,
  facebookUrl: urlOrNull,
  tiktokUrl: urlOrNull,
  aboutText: z.string().trim().max(5000).optional().transform((v) => v || null),
  shippingPolicy: z.string().trim().max(8000).optional().transform((v) => v || null),
  returnPolicy: z.string().trim().max(8000).optional().transform((v) => v || null),
  privacyPolicy: z.string().trim().max(12000).optional().transform((v) => v || null),
  termsAndConditions: z.string().trim().max(12000).optional().transform((v) => v || null),
  pickupEnabled: z.boolean(),
  pickupAddress: optionalText(200).transform((v) => v ?? null),
  pickupPrice: moneyField("El costo de recojo"),
  yapeEnabled: z.boolean(),
  yapeNumber: digitsPhone,
  yapeHolder: optionalText(80).transform((v) => v ?? null),
  yapeQrUrl: z.string().max(500).nullish().transform((v) => v || null),
  plinEnabled: z.boolean(),
  plinNumber: digitsPhone,
  plinHolder: optionalText(80).transform((v) => v ?? null),
  plinQrUrl: z.string().max(500).nullish().transform((v) => v || null),
  transferEnabled: z.boolean(),
  bankName: optionalText(60).transform((v) => v ?? null),
  bankAccountNumber: optionalText(40).transform((v) => v ?? null),
  bankCci: optionalText(40).transform((v) => v ?? null),
  bankHolder: optionalText(80).transform((v) => v ?? null),
  codEnabled: z.boolean(),
  paymentInstructions: z.string().trim().max(1000).optional().transform((v) => v || null),
  defaultMinStock: z.number().int().min(0).max(1000),
  whatsappNotificationsEnabled: z.boolean(),
  sizeGuide: z.array(z.object({ title: text("Título", 2, 80), headers: z.array(z.string().max(40)).min(1).max(8), rows: z.array(z.array(z.string().max(40)).max(8)).max(40) })).max(10),
});
export type SettingsInput = z.input<typeof settingsSchema>;
