import { expect, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";
import { ADMIN_STATE, CUSTOMER } from "./data";

/** Imagen PNG válida para usar como comprobante de pago. */
export async function proofImage() {
  const buffer = await sharp({ create: { width: 120, height: 200, channels: 3, background: "#e65385" } }).png().toBuffer();
  return { name: "comprobante.png", mimeType: "image/png", buffer };
}

/** Contexto de navegador aparte (otra sesión) ya autenticado como administrador. */
export async function adminPage(browser: Browser, baseURL: string | undefined) {
  const ctx = await browser.newContext({ baseURL, locale: "es-PE", storageState: ADMIN_STATE });
  return { ctx, page: await ctx.newPage() };
}

/** Abre un producto desde su URL, elige talla y lo agrega al carrito (el cajón «Tu carrito» debe mostrarlo). */
export async function addToCart(page: Page, slug: string, name: string, size: string) {
  await page.goto(`/productos/${slug}`);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.getByRole("button", { name: size, exact: true }).click();
  await page.getByRole("button", { name: /^Agregar al carrito/ }).first().click();
  const drawer = page.getByRole("dialog", { name: "Tu carrito" });
  await expect(drawer.getByText(name)).toBeVisible();
}

/** Del carrito al paso «Pago» del checkout, con datos de cliente y envío a domicilio en Lima. */
export async function goToPaymentStep(page: Page) {
  await page.goto("/carrito");
  await page.getByRole("link", { name: "Continuar con la compra" }).click();
  await page.waitForURL("**/checkout");
  await page.getByLabel("Nombres").fill(CUSTOMER.firstName);
  await page.getByLabel("Apellidos").fill(CUSTOMER.lastName);
  await page.getByLabel("Teléfono / celular").fill(CUSTOMER.phone);
  await page.getByLabel("Correo electrónico").fill(CUSTOMER.email);
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByLabel("Departamento").selectOption("Lima");
  await page.getByLabel("Provincia").fill("Lima");
  await page.getByLabel("Distrito").fill("Miraflores");
  await page.getByLabel("Dirección", { exact: true }).fill("Av. Larco 123");
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page.getByText("Envío a domicilio").first()).toBeVisible();
  // → Pago. Se reintenta el clic: mientras el resumen lateral recalcula el envío, el botón puede ignorar un clic aislado
  const payHeading = page.getByRole("heading", { name: "Método de pago" });
  await expect(async () => {
    if (!(await payHeading.isVisible())) await page.getByRole("button", { name: /Continuar/ }).click({ timeout: 10_000 });
    await expect(payHeading).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
}

/** Del paso «Pago» a la confirmación; devuelve el código del pedido. */
export async function confirmOrder(page: Page): Promise<string> {
  await page.getByRole("button", { name: /Continuar/ }).click(); // → Resumen
  // Crear el pedido tarda (varias consultas a la base remota): no se espera la navegación dentro del clic, sino aparte y con holgura
  // Regresión: «Continuar» solo debe mostrar el resumen; antes enviaba el pedido en el mismo clic
  await expect(page.getByRole("heading", { name: "Resumen y confirmación" })).toBeVisible();
  expect(page.url()).toContain("/checkout");
  expect(page.url()).not.toContain("confirmacion");
  const confirm = page.getByRole("button", { name: /Confirmar pedido/ });
  await expect(confirm).toBeEnabled(); // habilitado cuando el servidor ya calculó importes y envío
  await confirm.click({ noWaitAfter: true });
  await page.waitForURL("**/checkout/confirmacion/**", { timeout: 180_000 });
  const code = page.url().split("/").pop()!.split("?")[0];
  expect(code).toMatch(/^LJ-\d{6}-[A-Z0-9]{5}$/);
  return code;
}
