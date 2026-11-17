import "server-only";
import nodemailer from "nodemailer";

/**
 * Correo saliente (recuperación de contraseña). Requiere SMTP_HOST, SMTP_USER, SMTP_PASS (y opcional SMTP_PORT, SMTP_FROM).
 * Sin SMTP no se simula el envío: el administrador puede generar el enlace de recuperación desde el panel de Clientes.
 */
export function mailerConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendMail(opts: { to: string; subject: string; html: string; text: string }) {
  if (!mailerConfigured()) return { ok: false as const, error: "SMTP no configurado" };
  try {
    const port = Number(process.env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, ...opts });
    return { ok: true as const };
  } catch (e) {
    console.error("[mailer] error al enviar", e);
    return { ok: false as const, error: "No se pudo enviar el correo" };
  }
}
