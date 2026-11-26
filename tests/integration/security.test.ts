import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock de next/headers con un "navegador" controlable (cookies + cabeceras)
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k)! } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
    delete: (k: string) => void jar.delete(k),
  }),
  headers: async () => new Headers({ "user-agent": "vitest", "x-forwarded-for": "10.0.0.1" }),
}));

import { assertAdmin, assertUser, AuthError } from "@/lib/auth/guards";
import { createSession, getCurrentUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { loginAction, registerAction, resetPasswordAction, forgotPasswordAction } from "@/app/actions/auth";
import { saveCategoryAction } from "@/app/admin/actions/catalog";
import { adjustInventoryAction } from "@/app/admin/actions/inventory";
import { approvePaymentAction } from "@/app/admin/actions/orders";
import { toggleFavoriteAction } from "@/app/actions/account";
import { getAccessibleOrderId, grantGuestAccess } from "@/lib/auth/order-access";
import { rateLimit } from "@/lib/rate-limit";
import { createOrder } from "@/lib/services/orders";
import { createResetLink } from "@/lib/services/password-reset";
import { makeProduct, orderInput, prisma, resetDb, seedBasics } from "../helpers";

let customerId: string;
let adminId: string;

beforeEach(async () => {
  await resetDb();
  jar.clear();
  customerId = (await prisma.user.create({ data: { email: "c@test.com", name: "Cliente", passwordHash: await hashPassword("Clave1234"), role: "CUSTOMER" } })).id;
  adminId = (await prisma.user.create({ data: { email: "a@test.com", name: "Admin", passwordHash: await hashPassword("Admin12345"), role: "ADMIN" } })).id;
});

describe("autenticación y sesiones", () => {
  it("las contraseñas se guardan con bcrypt, nunca en claro", async () => {
    const r = await registerAction({ firstName: "Lu", lastName: "Cía", email: "nuevo@test.com", phone: "987654321", password: "Segura123", confirmPassword: "Segura123", acceptTerms: true });
    expect(r.ok).toBe(true);
    const u = await prisma.user.findUniqueOrThrow({ where: { email: "nuevo@test.com" } });
    expect(u.passwordHash).not.toContain("Segura123");
    expect(u.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(u.role).toBe("CUSTOMER"); // el registro público jamás crea administradores
    expect(await verifyPassword("Segura123", u.passwordHash)).toBe(true);
    expect((await getCurrentUser())?.email).toBe("nuevo@test.com"); // sesión iniciada
  });

  it("no permite registrar un correo duplicado", async () => {
    const r = await registerAction({ firstName: "Otra", lastName: "Persona", email: "c@test.com", phone: "987654321", password: "Segura123", confirmPassword: "Segura123", acceptTerms: true });
    expect(r).toMatchObject({ ok: false });
  });

  it("login correcto crea sesión (token hasheado en BD); incorrecto muestra mensaje genérico", async () => {
    const bad = await loginAction({ email: "c@test.com", password: "equivocada1" });
    const none = await loginAction({ email: "noexiste@test.com", password: "equivocada1" });
    expect(bad).toMatchObject({ ok: false, error: "Correo o contraseña incorrectos." });
    expect(none).toMatchObject({ ok: false, error: "Correo o contraseña incorrectos." }); // no revela si la cuenta existe
    const ok = await loginAction({ email: "c@test.com", password: "Clave1234" });
    expect(ok).toMatchObject({ ok: true, data: { redirectTo: "/mi-cuenta" } });
    const token = jar.get("lj_session")!;
    const s = await prisma.session.findFirstOrThrow({ where: { userId: customerId } });
    expect(s.tokenHash).not.toBe(token);
    expect(s.tokenHash).toHaveLength(64);
  });

  it("el administrador es redirigido al panel; un cliente jamás a /admin aunque lo pida", async () => {
    expect(await loginAction({ email: "a@test.com", password: "Admin12345" })).toMatchObject({ ok: true, data: { redirectTo: "/admin/dashboard" } });
    jar.clear();
    expect(await loginAction({ email: "c@test.com", password: "Clave1234", next: "/admin/dashboard" })).toMatchObject({ ok: true, data: { redirectTo: "/mi-cuenta" } });
    jar.clear();
    expect(await loginAction({ email: "c@test.com", password: "Clave1234", next: "//evil.com" })).toMatchObject({ data: { redirectTo: "/mi-cuenta" } });
  });

  it("rate limiting: bloquea tras demasiados intentos fallidos", async () => {
    for (let i = 0; i < 8; i++) await loginAction({ email: "c@test.com", password: `mala${i}xxxx` });
    const blocked = await loginAction({ email: "c@test.com", password: "Clave1234" });
    expect(blocked).toMatchObject({ ok: false, error: expect.stringMatching(/Demasiados intentos/) });
    expect(await rateLimit("k:test", 2, 60)).toBe(true);
    expect(await rateLimit("k:test", 2, 60)).toBe(true);
    expect(await rateLimit("k:test", 2, 60)).toBe(false);
  });

  it("sesión vencida o cuenta desactivada no autentican", async () => {
    await createSession(customerId);
    expect(await getCurrentUser()).toMatchObject({ id: customerId });
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await getCurrentUser()).toBeNull();
    await createSession(customerId);
    await prisma.user.update({ where: { id: customerId }, data: { isActive: false } });
    expect(await getCurrentUser()).toBeNull();
  });

  it("recuperación de acceso: token de un solo uso, vence y cierra sesiones", async () => {
    await createSession(customerId);
    const link = await createResetLink(customerId);
    const token = link.split("/").pop()!;
    expect(await resetPasswordAction({ token, password: "Nueva12345", confirmPassword: "Nueva12345" })).toMatchObject({ ok: true });
    expect(await prisma.session.count({ where: { userId: customerId } })).toBe(0);
    expect(await resetPasswordAction({ token, password: "Otra123456", confirmPassword: "Otra123456" })).toMatchObject({ ok: false }); // un solo uso
    jar.clear();
    expect(await loginAction({ email: "c@test.com", password: "Nueva12345" })).toMatchObject({ ok: true });
    const link2 = await createResetLink(customerId);
    await prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await resetPasswordAction({ token: link2.split("/").pop()!, password: "Otra123456", confirmPassword: "Otra123456" })).toMatchObject({ ok: false });
  });

  it("solicitar recuperación responde igual exista o no la cuenta", async () => {
    const a = await forgotPasswordAction({ email: "c@test.com" });
    const b = await forgotPasswordAction({ email: "fantasma@test.com" });
    expect(a).toEqual(b);
  });
});

describe("control de acceso por roles (en servidor)", () => {
  it("sin sesión: UNAUTHENTICATED; cliente: FORBIDDEN; admin: permitido", async () => {
    await expect(assertAdmin()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await createSession(customerId);
    await expect(assertAdmin()).rejects.toBeInstanceOf(AuthError);
    await expect(assertAdmin()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertUser()).resolves.toMatchObject({ role: "CUSTOMER" });
    jar.clear();
    await createSession(adminId);
    await expect(assertAdmin()).resolves.toMatchObject({ role: "ADMIN" });
  });

  it("las acciones administrativas rechazan a un cliente y no modifican datos", async () => {
    const b = await seedBasics();
    const { variant } = await makeProduct({ categoryId: b.category.id, sizeId: b.size.id, colorId: b.color.id, stock: 5 });
    await createSession(customerId);
    const cat = await saveCategoryAction({ name: "Hackeada", sortOrder: 0, isActive: true, showOnHome: true });
    const inv = await adjustInventoryAction({ variantId: variant.id, mode: "ENTRADA", quantity: 100, reason: "intento" });
    const pay = await approvePaymentAction("cualquiera");
    expect(cat).toMatchObject({ ok: false, error: expect.stringMatching(/permisos/) });
    expect(inv).toMatchObject({ ok: false });
    expect(pay).toMatchObject({ ok: false });
    expect(await prisma.category.count({ where: { name: "Hackeada" } })).toBe(0);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: variant.id } })).stock).toBe(5);
  });

  it("un administrador sí puede y queda registro de auditoría", async () => {
    await createSession(adminId);
    const r = await saveCategoryAction({ name: "Nueva categoría", sortOrder: 1, isActive: true, showOnHome: false });
    expect(r.ok).toBe(true);
    expect(await prisma.auditLog.count({ where: { userId: adminId, entity: "Category" } })).toBe(1);
  });

  it("favoritos requieren sesión y persisten en la BD", async () => {
    const b = await seedBasics();
    const { product } = await makeProduct({ categoryId: b.category.id, sizeId: b.size.id, colorId: b.color.id });
    expect(await toggleFavoriteAction(product.id)).toMatchObject({ ok: false });
    await createSession(customerId);
    expect(await toggleFavoriteAction(product.id)).toMatchObject({ ok: true, data: { favorited: true } });
    expect(await prisma.favorite.count({ where: { userId: customerId } })).toBe(1);
    expect(await toggleFavoriteAction(product.id)).toMatchObject({ data: { favorited: false } });
  });
});

describe("acceso a pedidos (cliente / invitado / admin)", () => {
  it("un cliente solo ve sus pedidos; un invitado solo los que creó; el admin todos", async () => {
    const b = await seedBasics();
    const { variant } = await makeProduct({ categoryId: b.category.id, sizeId: b.size.id, colorId: b.color.id, stock: 9 });
    const mine = await createOrder(orderInput(variant.id, 1), customerId);
    const guest = await createOrder(orderInput(variant.id, 1), null);

    // sin sesión ni cookie: nada
    expect(await getAccessibleOrderId(mine.code)).toBeNull();
    expect(await getAccessibleOrderId(guest.code)).toBeNull();
    // invitado con cookie firmada de SU pedido
    await grantGuestAccess(guest.code);
    expect(await getAccessibleOrderId(guest.code)).toBe(guest.id);
    expect(await getAccessibleOrderId(mine.code)).toBeNull();
    // cookie manipulada no sirve
    jar.set("lj_guest_orders", jar.get("lj_guest_orders")!.replace(/.$/, "A") + "x");
    expect(await getAccessibleOrderId(guest.code)).toBeNull();
    // cliente dueño
    jar.clear();
    await createSession(customerId);
    expect(await getAccessibleOrderId(mine.code)).toBe(mine.id);
    expect(await getAccessibleOrderId(guest.code)).toBeNull();
    // otro cliente no
    jar.clear();
    const other = await prisma.user.create({ data: { email: "o@test.com", name: "Otro", passwordHash: "x" } });
    await createSession(other.id);
    expect(await getAccessibleOrderId(mine.code)).toBeNull();
    // admin
    jar.clear();
    await createSession(adminId);
    expect(await getAccessibleOrderId(mine.code)).toBe(mine.id);
    expect(await getAccessibleOrderId(guest.code)).toBe(guest.id);
  });
});
