import "server-only";
import { prisma } from "@/lib/prisma";
import { hashToken, newToken } from "@/lib/auth/tokens";
import { absoluteUrl } from "@/lib/utils";

/**
 * Crea un token de recuperación (1 h, un solo uso) e invalida los anteriores. Devuelve la URL.
 *
 * NO comprueba quién la llama: quien la use debe hacerlo (el flujo «olvidé mi contraseña» solo la envía al correo
 * del propio usuario; el panel exige ADMIN). Por eso vive aquí y no en un archivo "use server": todo lo que se
 * exporta desde uno de esos archivos se publica como endpoint invocable desde el navegador.
 */
export async function createResetLink(userId: string) {
  const token = newToken();
  await prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.passwordResetToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600_000) } });
  return absoluteUrl(`/restablecer/${token}`);
}
