import "server-only";

/**
 * Integración opcional con WhatsApp Business Cloud API (Meta).
 * Solo se envía si existen WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_ACCESS_TOKEN en el entorno
 * Y el administrador activó las notificaciones en Configuración. En cualquier otro caso
 * NO se simula ningún envío: la notificación queda como "NOT_CONFIGURED".
 *
 * Nota: la API de Meta solo permite texto libre dentro de la ventana de 24 h de conversación;
 * fuera de ella se requieren plantillas aprobadas. Mientras tanto el panel ofrece un enlace
 * "wa.me" con el mensaje prellenado para enviarlo manualmente.
 */
export function whatsappEnvConfigured() {
  return !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

export async function sendWhatsAppText(toDigits: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!whatsappEnvConfigured()) return { ok: false, error: "WhatsApp no configurado" };
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: toDigits, type: "text", text: { body } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status} ${t.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error de red" };
  }
}
