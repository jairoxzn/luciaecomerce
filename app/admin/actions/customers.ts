"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { run, UserError, type ActionResult } from "@/lib/action";
import { assertAdmin } from "@/lib/auth/guards";
import { logAudit } from "@/lib/audit";
import { createResetLink } from "@/lib/services/password-reset";

export async function toggleCustomerActiveAction(userId: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await assertAdmin();
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } });
    if (!u) throw new UserError("Cliente no encontrado.");
    if (u.role === "ADMIN") throw new UserError("No se puede desactivar una cuenta de administrador desde aquí.");
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { isActive: !u.isActive } }),
      ...(u.isActive ? [prisma.session.deleteMany({ where: { userId } })] : []),
    ]);
    await logAudit(admin.id, u.isActive ? "DEACTIVATE_USER" : "ACTIVATE_USER", "User", userId);
    revalidatePath("/admin/clientes");
    revalidatePath(`/admin/clientes/${userId}`);
    return { ok: true, message: u.isActive ? "Cuenta desactivada y sesiones cerradas." : "Cuenta reactivada." };
  });
}

/** Genera un enlace de recuperación (1 h) para entregarlo al cliente cuando no hay SMTP configurado. */
export async function generateResetLinkAction(userId: string): Promise<ActionResult<{ link: string }>> {
  return run<{ link: string }>(async () => {
    const admin = await assertAdmin();
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!u) throw new UserError("Cliente no encontrado.");
    if (u.role === "ADMIN") throw new UserError("Por seguridad no se generan enlaces para administradores.");
    const link = await createResetLink(userId);
    await logAudit(admin.id, "GENERATE_RESET_LINK", "User", userId);
    return { ok: true, data: { link }, message: "Enlace generado (vence en 1 hora)." };
  });
}

export async function markMessageReadAction(id: string): Promise<ActionResult> {
  return run(async () => {
    await assertAdmin();
    await prisma.contactMessage.update({ where: { id }, data: { readAt: new Date() } });
    revalidatePath("/admin/mensajes");
    return { ok: true };
  });
}
