import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Prisma } from "@prisma/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Decimal de Prisma (o number/string) → number */
export function num(v: Prisma.Decimal | number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v.toString());
}

/** Soles → céntimos enteros (evita errores de coma flotante) */
export const toCents = (v: number) => Math.round(v * 100);
export const fromCents = (c: number) => c / 100;
export const dec = (cents: number) => new Prisma.Decimal((cents / 100).toFixed(2));

const pen = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", currencyDisplay: "narrowSymbol" });
export function formatPEN(v: number) {
  return pen.format(v).replace("PEN", "S/").replace(/\s/g, " ");
}

const TZ = "America/Lima";
export function formatDate(d: Date | string, withTime = false) {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(d));
}

/** YYYY-MM-DD en hora de Lima */
export function limaDateKey(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return parts;
}

/** Inicio del día (00:00 Lima, UTC-5 sin DST) como Date UTC */
export function startOfLimaDay(d = new Date()) {
  const key = limaDateKey(d);
  return new Date(`${key}T00:00:00-05:00`);
}
export function startOfLimaMonth(d = new Date()) {
  const key = limaDateKey(d).slice(0, 7);
  return new Date(`${key}-01T00:00:00-05:00`);
}
export function parseLimaDate(s: string, endOfDay = false) {
  return new Date(`${s}T${endOfDay ? "23:59:59.999" : "00:00:00"}-05:00`);
}

export function slugify(text: string) {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function discountPercent(price: number, sale: number | null | undefined) {
  if (!sale || sale >= price || price <= 0) return 0;
  return Math.round((1 - sale / price) * 100);
}

export function pluralize(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

export function absoluteUrl(path = "/") {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Solo dígitos, para wa.me / tel: */
export function digitsOnly(s: string | null | undefined) {
  return (s ?? "").replace(/\D/g, "");
}

export function normalizePeruPhone(s: string) {
  const d = digitsOnly(s);
  if (d.length === 9) return `51${d}`;
  return d;
}
