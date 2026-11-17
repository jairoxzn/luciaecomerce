// Prueba E2E manual (Playwright + Edge instalado). Uso:  BASE_URL=http://localhost:3002 node tests/e2e/smoke.mjs
// Recorre: producto → carrito → cupón → checkout (contra entrega) → confirmación → panel admin (estado, cancelación).
import { chromium } from "playwright-core";
import fs from "fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR || ".";
const env = Object.fromEntries(fs.readFileSync(".env", "utf8").split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)="?([^"]*)"?$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const edge = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));

const log = (...a) => console.log("•", ...a);
const fail = (m) => { console.error("✗ FALLÓ:", m); process.exitCode = 1; };
const expect = (c, m) => (c ? log("OK", m) : fail(m));

const browser = await chromium.launch({ executablePath: edge, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "es-PE" });
const page = await ctx.newPage();
page.on("pageerror", (e) => fail(`error de página: ${e.message}`));
page.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()) && console.log("  consola:", m.text().slice(0, 160)));

try {
  // 1) Producto → agregar al carrito
  await page.goto(`${BASE}/productos/jean-mom-fit-mujer`, { waitUntil: "networkidle" });
  expect((await page.title()).includes("Jean Mom Fit"), "título de producto");
  const addBtn = page.getByRole("button", { name: /Elige una talla/ });
  expect(await addBtn.isDisabled(), "botón deshabilitado hasta elegir talla");
  const sizeBtn = page.locator("button[aria-pressed]:not([disabled])").filter({ hasText: /^\d{2}$/ }).first();
  await sizeBtn.click();
  await page.getByRole("button", { name: /^Agregar al carrito/ }).first().click();
  await page.getByRole("dialog", { name: "Tu carrito" }).waitFor();
  await page.getByRole("dialog", { name: "Tu carrito" }).getByText("Jean Mom Fit Mujer").waitFor({ timeout: 15000 });
  log("OK carrito (drawer) muestra el producto");
  await page.screenshot({ path: `${SHOTS}/e2e-1-drawer.png` });
  // subir a 2 unidades
  await page.getByRole("dialog").getByRole("button", { name: "Aumentar cantidad" }).click();
  await page.waitForTimeout(800);

  // 2) Carrito + cupón
  await page.goto(`${BASE}/carrito`, { waitUntil: "networkidle" });
  await page.getByLabel("Código de cupón").fill("BIENVENIDA10");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await page.getByText("aplicado").waitFor({ timeout: 15000 });
  expect(await page.getByText(/Descuento/).first().isVisible(), "cupón aplicado con descuento");
  await page.screenshot({ path: `${SHOTS}/e2e-2-carrito.png` });

  // 3) Checkout
  await page.getByRole("link", { name: "Continuar con la compra" }).click();
  await page.waitForURL("**/checkout");
  await page.getByLabel("Nombres").fill("Prueba");
  await page.getByLabel("Apellidos").fill("Automática");
  await page.getByLabel("Teléfono / celular").fill("987654321");
  await page.getByLabel("Correo electrónico").fill("e2e@example.com");
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByLabel("Departamento").selectOption("Lima");
  await page.getByLabel("Provincia").fill("Lima");
  await page.getByLabel("Distrito").fill("Miraflores");
  await page.getByLabel("Dirección", { exact: true }).fill("Av. Larco 123");
  await page.getByRole("button", { name: /Continuar/ }).click();
  expect(await page.getByText("Envío a domicilio").first().isVisible(), "paso Entrega");
  await page.getByRole("button", { name: /Continuar/ }).click();
  expect(await page.getByText("Contra entrega").first().isVisible(), "paso Pago con contra entrega disponible");
  await page.screenshot({ path: `${SHOTS}/e2e-3-checkout-pago.png` });
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByRole("button", { name: /Confirmar pedido/ }).click();
  await page.waitForURL("**/checkout/confirmacion/**", { timeout: 40000 });
  const code = page.url().split("/").pop();
  expect(/^LJ-\d{6}-[A-Z0-9]{5}$/.test(code), `pedido confirmado (${code})`);
  await page.screenshot({ path: `${SHOTS}/e2e-4-confirmacion.png`, fullPage: true });

  // 4) Admin
  const admin = await ctx.newPage();
  await admin.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await admin.getByLabel("Correo electrónico").fill(env.ADMIN_EMAIL);
  await admin.getByLabel("Contraseña", { exact: true }).fill(env.ADMIN_PASSWORD);
  await admin.getByRole("button", { name: "Iniciar sesión" }).click();
  await admin.waitForURL("**/admin/dashboard", { timeout: 30000 });
  expect(await admin.getByText("Ventas del día").isVisible(), "dashboard admin carga");
  await admin.waitForTimeout(1500);
  await admin.screenshot({ path: `${SHOTS}/e2e-5-dashboard.png`, fullPage: true });

  await admin.goto(`${BASE}/admin/pedidos?q=${code}`, { waitUntil: "networkidle" });
  await admin.getByRole("link", { name: code }).click();
  await admin.waitForURL("**/admin/pedidos/**");
  await admin.getByLabel("Nuevo estado").selectOption({ label: "Preparando" });
  await admin.getByRole("button", { name: "Actualizar estado" }).click();
  await admin.getByText("Estado actualizado").first().waitFor({ timeout: 15000 });
  log("OK estado cambiado a Preparando (contra entrega)");
  await admin.screenshot({ path: `${SHOTS}/e2e-6-pedido-admin.png`, fullPage: true });

  // seguimiento del invitado ve el historial
  await page.goto(`${BASE}/pedidos/${code}`, { waitUntil: "networkidle" });
  expect(await page.getByText("Preparando").first().isVisible(), "el cliente ve el nuevo estado en su seguimiento");

  // cancelar devuelve stock
  await admin.getByLabel("Nuevo estado").selectOption({ label: "Cancelado" });
  await admin.getByRole("button", { name: "Actualizar estado" }).click();
  await admin.getByRole("button", { name: "Cancelar pedido" }).click();
  await admin.getByText("Estado actualizado").first().waitFor({ timeout: 15000 });
  log("OK pedido cancelado desde el panel");
} catch (e) {
  fail(e.message);
  await page.screenshot({ path: `${SHOTS}/e2e-error.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}
