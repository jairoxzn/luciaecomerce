"use server";

import { prisma } from "@/lib/prisma";
import { run, type ActionResult, UserError } from "@/lib/action";
import { hashPassword, verifyPassword, DUMMY_HASH } from "@/lib/auth/password";
import { createSession, destroySession, destroyAllSessions, getCurrentUser, currentTokenHash } from "@/lib/auth/session";
import { hashToken, newToken } from "@/lib/auth/tokens";
import { assertUser } from "@/lib/auth/guards";
import { clientIp, rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { forgotSchema, loginSchema, registerSchema, resetSchema, safeNext, changePasswordSchema, profileSchema, type LoginInput, type RegisterInput, type ProfileInput } from "@/lib/validations/auth";
import { mailerConfigured, sendMail } from "@/lib/mailer";
import { absoluteUrl } from "@/lib/utils";
import { getSettings } from "@/lib/services/settings";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

type Redirect = { redirectTo: string };

export async function registerAction(raw: RegisterInput): Promise<ActionResult<Redirect>> {
  return run<Redirect>(async () => {
    const ip = await clientIp();
    if (!(await rateLimit(`register:${ip}`, 6, 3600))) throw new UserError("Demasiados intentos. Inténtalo más tarde.");
    const input = registerSchema.parse(raw);
    const exists = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (exists) throw new UserError("Ya existe una cuenta con este correo. Inicia sesión.");
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: `${input.firstName} ${input.lastName}`,
        passwordHash: await hashPassword(input.password),
        role: "CUSTOMER",
        profile: { create: { firstName: input.firstName, lastName: input.lastName, phone: input.phone } },
      },
    });
    await createSession(user.id);
    return { ok: true, data: { redirectTo: "/mi-cuenta" }, message: "¡Cuenta creada! Bienvenida a LUCIA JEANS." };
  });
}

export async function loginAction(raw: LoginInput): Promise<ActionResult<Redirect>> {
  return run<Redirect>(async () => {
    const input = loginSchema.parse(raw);
    const ip = await clientIp();
    const key = `login:${ip}:${input.email}`;
    if (!(await rateLimit(key, 8, 15 * 60)) || !(await rateLimit(`login-ip:${ip}`, 40, 15 * 60))) {
      throw new UserError("Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.");
    }
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    // Siempre se ejecuta bcrypt para igualar tiempos (evita enumerar cuentas)
    const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid || !user.isActive) throw new UserError("Correo o contraseña incorrectos.");
    await resetRateLimit(key);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await createSession(user.id);
    if (user.role === "ADMIN") await logAudit(user.id, "LOGIN", "User", user.id);
    const next = safeNext(input.next);
    const dest = user.role === "ADMIN" ? (next?.startsWith("/admin") ? next : "/admin/dashboard") : (next?.startsWith("/admin") ? "/mi-cuenta" : (next ?? "/mi-cuenta"));
    return { ok: true, data: { redirectTo: dest }, message: `Hola, ${user.name.split(" ")[0]}` };
  });
}

export async function logoutAction(): Promise<ActionResult> {
  return run(async () => {
    await destroySession();
    return { ok: true };
  });
}

/** Crea un token de recuperación (1 h). Devuelve la URL (solo para uso interno / panel admin). */
export async function createResetLink(userId: string) {
  const token = newToken();
  await prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.passwordResetToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600_000) } });
  return absoluteUrl(`/restablecer/${token}`);
}

export async function forgotPasswordAction(raw: { email: string }): Promise<ActionResult<{ emailConfigured: boolean }>> {
  return run(async () => {
    const { email } = forgotSchema.parse(raw);
    const ip = await clientIp();
    if (!(await rateLimit(`forgot:${ip}`, 5, 3600)) || !(await rateLimit(`forgot-mail:${email}`, 3, 3600))) {
      throw new UserError("Demasiadas solicitudes. Inténtalo más tarde.");
    }
    const configured = mailerConfigured();
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.isActive) {
      const link = await createResetLink(user.id);
      if (configured) {
        const s = await getSettings();
        await sendMail({
          to: email,
          subject: `Recupera tu acceso a ${s.storeName}`,
          text: `Hola ${user.name},\n\nUsa este enlace para crear una nueva contraseña (vence en 1 hora):\n${link}\n\nSi no fuiste tú, ignora este mensaje.`,
          html: `<p>Hola ${user.name},</p><p>Usa este enlace para crear una nueva contraseña (vence en 1 hora):</p><p><a href="${link}">${link}</a></p><p>Si no fuiste tú, ignora este mensaje.</p>`,
        });
      } else if (process.env.NODE_ENV !== "production") {
        console.log(`[recuperación] SMTP no configurado. Enlace para ${email}: ${link}`);
      }
    }
    // Respuesta idéntica exista o no la cuenta (no revela qué correos están registrados)
    return { ok: true, data: { emailConfigured: configured } };
  });
}

export async function resetPasswordAction(raw: { token: string; password: string; confirmPassword: string }): Promise<ActionResult> {
  return run(async () => {
    const input = resetSchema.parse(raw);
    const ip = await clientIp();
    if (!(await rateLimit(`reset:${ip}`, 10, 3600))) throw new UserError("Demasiados intentos. Inténtalo más tarde.");
    const rec = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(input.token) } });
    if (!rec || rec.usedAt || rec.expiresAt < new Date()) throw new UserError("El enlace es inválido o ya venció. Solicita uno nuevo.");
    const hash = await hashPassword(input.password);
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({ where: { id: rec.id, usedAt: null }, data: { usedAt: new Date() } });
      if (claimed.count === 0) throw new UserError("El enlace ya fue utilizado.");
      await tx.user.update({ where: { id: rec.userId }, data: { passwordHash: hash } });
      await tx.session.deleteMany({ where: { userId: rec.userId } }); // cierra todas las sesiones
    });
    return { ok: true, message: "Contraseña actualizada. Ya puedes iniciar sesión." };
  });
}

export async function changePasswordAction(raw: { currentPassword: string; newPassword: string; confirmPassword: string }): Promise<ActionResult> {
  return run(async () => {
    const me = await assertUser();
    const input = changePasswordSchema.parse(raw);
    if (!(await rateLimit(`chpw:${me.id}`, 6, 3600))) throw new UserError("Demasiados intentos. Inténtalo más tarde.");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) throw new UserError("La contraseña actual es incorrecta.");
    await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(input.newPassword) } });
    await destroyAllSessions(me.id, await currentTokenHash()); // mantiene solo la sesión actual
    return { ok: true, message: "Contraseña actualizada." };
  });
}

export async function updateProfileAction(raw: ProfileInput): Promise<ActionResult> {
  return run(async () => {
    const me = await assertUser();
    const input = profileSchema.parse(raw);
    await prisma.$transaction([
      prisma.customerProfile.upsert({
        where: { userId: me.id },
        update: { firstName: input.firstName, lastName: input.lastName, phone: input.phone, dni: input.dni ?? null },
        create: { userId: me.id, firstName: input.firstName, lastName: input.lastName, phone: input.phone, dni: input.dni ?? null },
      }),
      prisma.user.update({ where: { id: me.id }, data: { name: `${input.firstName} ${input.lastName}` } }),
    ]);
    revalidatePath("/mi-cuenta");
    return { ok: true, message: "Perfil actualizado." };
  });
}

export async function whoAmI() {
  return getCurrentUser();
}
