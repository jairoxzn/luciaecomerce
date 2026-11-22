"use server";

import { z } from "zod";
import { run, UserError, type ActionResult } from "@/lib/action";
import { getCurrentUser } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { subscribeStockAlert } from "@/lib/services/stock-alerts";
import { emailField, phoneField } from "@/lib/validations/common";

const schema = z.object({
  variantId: z.string().min(1).max(40),
  email: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
});

/** «Avísame cuando haya stock»: el cliente deja su correo y/o celular para una variante agotada. */
export async function subscribeStockAlertAction(raw: z.input<typeof schema>): Promise<ActionResult> {
  return run(async () => {
    const ip = await clientIp();
    if (!(await rateLimit(`stock-alert:${ip}`, 15, 3600))) throw new UserError("Demasiadas solicitudes. Inténtalo más tarde.");
    const i = schema.parse(raw);
    const email = i.email ? emailField.parse(i.email) : null;
    const phone = i.phone ? phoneField.parse(i.phone) : null;
    const user = await getCurrentUser();
    await subscribeStockAlert({ variantId: i.variantId, email, phone, userId: user?.id ?? null });
    return { ok: true, message: "¡Listo! Te avisaremos apenas vuelva a haber stock." };
  });
}
