import { z } from "zod";
import { dniField, emailField, nameField, passwordField, phoneField, optionalText } from "./common";

export const registerSchema = z
  .object({
    firstName: nameField("Nombres"),
    lastName: nameField("Apellidos"),
    email: emailField,
    phone: phoneField,
    password: passwordField,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { error: "Debes aceptar los términos y condiciones" }),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Las contraseñas no coinciden" });

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Ingresa tu contraseña").max(72),
  next: z.string().max(200).optional(),
});

export const forgotSchema = z.object({ email: emailField });

export const resetSchema = z
  .object({
    token: z.string().min(20).max(100),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Las contraseñas no coinciden" });

export const profileSchema = z.object({
  firstName: nameField("Nombres"),
  lastName: nameField("Apellidos"),
  phone: phoneField,
  dni: dniField,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Ingresa tu contraseña actual"),
    newPassword: passwordField,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ["confirmPassword"], message: "Las contraseñas no coinciden" });

export const addressSchema = z.object({
  id: z.string().optional(),
  label: nameField("Etiqueta", 2),
  recipient: nameField("Destinatario", 3),
  phone: phoneField,
  department: z.string().trim().min(2, "Selecciona el departamento").max(40),
  province: z.string().trim().min(2, "Ingresa la provincia").max(60),
  district: z.string().trim().min(2, "Ingresa el distrito").max(60),
  line: z.string().trim().min(5, "Ingresa la dirección completa").max(200),
  reference: optionalText(200),
  isDefault: z.boolean().default(false),
});

export type RegisterInput = z.input<typeof registerSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type ProfileInput = z.input<typeof profileSchema>;
export type AddressInput = z.input<typeof addressSchema>;

/** Solo rutas internas (evita open-redirect) */
export function safeNext(next?: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  return next;
}
