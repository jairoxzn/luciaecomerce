import { expect, test } from "@playwright/test";
import { PRODUCTS } from "./data";
import { addToCart, adminPage, confirmOrder, goToPaymentStep, proofImage } from "./helpers";

test.describe("compra: catálogo → carrito → pago", () => {
  test("Yape con comprobante en el checkout: el admin se entera al instante y aprueba el pago", async ({ page, browser }) => {
    const baseURL = test.info().project.use.baseURL;

    // El administrador ya tiene abierta la cola de pagos (sin nada pendiente)
    const { ctx: adminCtx, page: admin } = await adminPage(browser, baseURL);
    await admin.goto("/admin/pagos");
    await expect(admin.getByText("No hay pagos pendientes de revisión")).toBeVisible();

    // Cliente: entra por el catálogo, elige el producto y lo agrega
    await page.goto("/catalogo");
    await page.locator("article").filter({ hasText: PRODUCTS.jean.name }).getByRole("link", { name: PRODUCTS.jean.name }).first().click();
    await page.waitForURL(`**/productos/${PRODUCTS.jean.slug}`);
    await addToCart(page, PRODUCTS.jean.slug, PRODUCTS.jean.name, "M");

    // Checkout con Yape y comprobante adjunto en el mismo paso de pago
    await goToPaymentStep(page);
    await page.getByRole("radio", { name: /Yape/ }).check();
    await page.getByTestId("proof-input").setInputFiles(await proofImage());
    await expect(page.getByAltText("Vista previa del comprobante")).toBeVisible();
    await page.getByLabel("N.° de operación (opcional)").fill("E2E-0001");
    const code = await confirmOrder(page);

    // La confirmación ya muestra el pago «en revisión»: no hace falta subir nada después
    await expect(page.getByText("Recibimos tu comprobante")).toBeVisible();
    await expect(page.getByTestId("proof-input")).toHaveCount(0);

    // El panel del administrador avisa sin recargar (consulta cada 15 s): contador, aviso y pago en la cola
    await expect(admin.getByText("1 pago por revisar")).toBeVisible({ timeout: 45_000 });
    await expect(admin.getByText(`Comprobante recibido · ${code}`).first()).toBeVisible({ timeout: 45_000 });
    await expect(admin.getByRole("heading", { name: new RegExp(code) })).toBeVisible({ timeout: 30_000 });
    await expect(admin.getByText(/Esperando/)).toBeVisible();

    await admin.getByRole("button", { name: "Aprobar pago" }).click();
    await admin.getByRole("button", { name: "Sí, aprobar" }).click();
    await expect(admin.getByRole("heading", { name: new RegExp(code) })).toHaveCount(0, { timeout: 30_000 });

    // El cliente ve el pago confirmado
    await page.reload();
    await expect(page.getByText("Pago confirmado").first()).toBeVisible();
    await adminCtx.close();
  });

  test("contra entrega: no pide comprobante y el formato inválido no bloquea el pedido", async ({ page }) => {
    await addToCart(page, PRODUCTS.skinny.slug, PRODUCTS.skinny.name, "S");
    await goToPaymentStep(page);

    // Un archivo que no es imagen ni PDF se rechaza con un mensaje claro
    await page.getByRole("radio", { name: /Yape/ }).check();
    await page.getByTestId("proof-input").setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("hola") });
    await expect(page.getByText("Formato no permitido")).toBeVisible();

    // Contra entrega: el bloque del comprobante desaparece
    await page.getByRole("radio", { name: /Contra entrega/ }).check();
    await expect(page.getByTestId("proof-input")).toHaveCount(0);

    const code = await confirmOrder(page);
    await expect(page.getByText(code).first()).toBeVisible();
  });

  test("Yape sin adjuntar: el pedido se crea y el comprobante se sube después desde el pedido", async ({ page }) => {
    await addToCart(page, PRODUCTS.hombre.slug, PRODUCTS.hombre.name, "L");
    await goToPaymentStep(page);
    await page.getByRole("radio", { name: /Yape/ }).check();
    const code = await confirmOrder(page);

    // Sin comprobante todavía: la página del pedido ofrece subirlo
    await expect(page.getByText("Sube tu comprobante de pago")).toBeVisible();
    await page.getByTestId("proof-input").setInputFiles(await proofImage());
    await page.getByRole("button", { name: "Enviar comprobante" }).click();
    await expect(page.getByText("Recibimos tu comprobante")).toBeVisible();
    expect(code).toBeTruthy();
  });
});
