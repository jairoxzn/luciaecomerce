import { z } from "zod";

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export const nameField = (label: string, min = 2) =>
  z.string({ error: `${label} es obligatorio` }).transform(clean).pipe(z.string().min(min, `${label}: mínimo ${min} caracteres`).max(80, `${label}: máximo 80 caracteres`));

export const emailField = z
  .string({ error: "El correo es obligatorio" })
  .transform((s) => s.trim().toLowerCase())
  .pipe(z.email("Ingresa un correo válido").max(120));

/** Celular peruano: 9 dígitos que empiezan con 9 (admite +51 / espacios). */
export const phoneField = z
  .string({ error: "El teléfono es obligatorio" })
  .transform((s) => s.replace(/[\s\-()]/g, "").replace(/^\+?51/, ""))
  .pipe(z.string().regex(/^9\d{8}$/, "Ingresa un celular válido de 9 dígitos (ej. 987654321)"));

export const dniField = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().regex(/^\d{8}$/, "El DNI debe tener 8 dígitos").or(z.literal("")))
  .optional()
  .transform((v) => (v ? v : undefined));

export const passwordField = z
  .string({ error: "La contraseña es obligatoria" })
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "La contraseña es demasiado larga")
  .regex(/[A-Za-z]/, "Incluye al menos una letra")
  .regex(/\d/, "Incluye al menos un número");

export const optionalText = (max = 500) =>
  z
    .string()
    .transform(clean)
    .pipe(z.string().max(max, `Máximo ${max} caracteres`))
    .optional()
    .transform((v) => (v ? v : undefined));

export const moneyField = (label: string) =>
  z.number({ error: `${label} debe ser un número` }).min(0, `${label} no puede ser negativo`).max(1_000_000, `${label} es demasiado alto`);

export const idField = z.string().min(1).max(40);
