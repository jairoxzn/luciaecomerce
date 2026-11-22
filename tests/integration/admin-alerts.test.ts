import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { rm } from "fs/promises";

const mail = vi.hoisted(() => ({ configured: true, sent: [] as { to: string; subject: string; text: string }[] }));
vi.mock("@/lib/mailer", () => ({
  mailerConfigured: () => mail.configured,
  sendMail: async (m: { to: string; subject: string; text: string }) => {
    mail.sent.push(m);
    return { ok: true as const };
  },
}));

import { createOrder } from "@/lib/services/orders";
import { submitPaymentProof } from "@/lib/services/payments";
import { getAdminAlerts } from "@/lib/services/admin-alerts";
import { makeProduct, orderInput, prisma, resetDb, seedBasics } from "../helpers";

let orderId: string;
let code: string;

async function png() {
  const buf = await sharp({ create: { width: 40, height: 60, channels: 3, background: "#e65385" } }).png().toBuffer();
  return new File([new Uint8Array(buf)], "comprobante.png", { type: "image/png" });
}

beforeEach(async () => {
  await resetDb();
  mail.configured = true;
  mail.sent = [];
  const b = await seedBasics();
  await prisma.user.create({ data: { email: "admin@test.com", name: "Admin", passwordHash: "x", role: "ADMIN" } });
  await prisma.user.create({ data: { email: "baja@test.com", name: "Ex admin", passwordHash: "x", role: "ADMIN", isActive: false } });
  await prisma.user.create({ data: { email: "cliente@test.com", name: "Cliente", passwordHash: "x", role: "CUSTOMER" } });
  const { variant } = await makeProduct({ categoryId: b.category.id, sizeId: b.size.id, colorId: b.color.id, stock: 5 });
  const o = await createOrder(orderInput(variant.id, 1), null);
  orderId = o.id;
  code = o.code;
  mail.sent = []; // descarta el correo del pedido nuevo: aquí interesa el del comprobante
});
afterAll(async () => {
  await rm(process.env.UPLOAD_DIR!, { recursive: true, force: true });
});

describe("avisos inmediatos al administrador", () => {
  it("un comprobante nuevo avisa por correo solo a administradores activos, con enlace a Pagos", async () => {
    await submitPaymentProof({ orderId, file: await png(), operationNumber: "99" });
    const proofMails = mail.sent.filter((m) => m.subject.includes("Comprobante recibido"));
    expect(proofMails.map((m) => m.to)).toEqual(["admin@test.com"]);
    expect(proofMails[0].subject).toContain(code);
    expect(proofMails[0].text).toContain("/admin/pagos");
  });

  it("sin SMTP no se envía ni se simula el correo, pero el aviso del panel sí se registra", async () => {
    mail.configured = false;
    await submitPaymentProof({ orderId, file: await png() });
    expect(mail.sent).toHaveLength(0);
    const n = await prisma.notification.findFirst({ where: { forAdmin: true, type: "PAGO_RECIBIDO" } });
    expect(n?.title).toContain(code);
  });

  it("los contadores del panel reflejan el comprobante en revisión", async () => {
    expect((await getAdminAlerts()).badges.payments).toBe(0);
    await submitPaymentProof({ orderId, file: await png() });
    const a = await getAdminAlerts();
    expect(a.badges.payments).toBe(1);
    expect(a.notifications[0]).toMatchObject({ read: false, orderCode: code });
    expect(a.notifications[0].title).toMatch(/Comprobante recibido/);
  });
});
