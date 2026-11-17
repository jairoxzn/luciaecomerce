import { z } from "zod";
import { dniField, emailField, nameField, optionalText, phoneField } from "./common";
import { MAX_CART_QTY } from "@/lib/constants";

export const cartItemSchema = z.object({
  variantId: z.string().min(1).max(40),
  quantity: z.number().int().min(1).max(MAX_CART_QTY),
});

export const customerSchema = z.object({
  firstName: nameField("Nombres"),
  lastName: nameField("Apellidos"),
  dni: dniField,
  phone: phoneField,
  email: emailField,
});

export const deliverySchema = z
  .object({
    method: z.enum(["DELIVERY", "PICKUP"]),
    department: z.string().trim().max(40).optional(),
    province: z.string().trim().max(60).optional(),
    district: z.string().trim().max(60).optional(),
    addressLine: z.string().trim().max(200).optional(),
    reference: optionalText(200),
  })
  .superRefine((d, ctx) => {
    if (d.method === "DELIVERY") {
      const req: [keyof typeof d, string][] = [
        ["department", "Selecciona el departamento"],
        ["province", "Ingresa la provincia"],
        ["district", "Ingresa el distrito"],
        ["addressLine", "Ingresa la dirección completa"],
      ];
      for (const [k, msg] of req) {
        const v = d[k];
        if (!v || String(v).length < 2) ctx.addIssue({ code: "custom", path: [k], message: msg });
      }
    }
  });

export const placeOrderSchema = z.object({
  idempotencyKey: z.string().min(16).max(64),
  items: z.array(cartItemSchema).min(1, "Tu carrito está vacío").max(40),
  couponCode: z.string().trim().max(40).optional(),
  customer: customerSchema,
  delivery: deliverySchema,
  paymentMethod: z.enum(["YAPE", "PLIN", "TRANSFER", "COD"]),
  customerNote: optionalText(300),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type PlaceOrderFormInput = z.input<typeof placeOrderSchema>;
