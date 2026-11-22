import { expect, test, type Page } from "@playwright/test";
import { PRODUCTS } from "./data";

// El panel de filtros es una barra lateral en escritorio y un cajón («Filtros») en móvil
async function filterPanel(page: Page) {
  const mobile = (page.viewportSize()?.width ?? 1280) < 1024;
  if (!mobile) return page.getByRole("complementary", { name: "Filtros" });
  await page.getByRole("button", { name: /^Filtros/ }).click();
  return page.getByRole("dialog", { name: "Filtros" });
}

test.describe("catálogo", () => {
  test("muestra cabecera, categorías con acceso directo y todos los productos activos", async ({ page }) => {
    await page.goto("/catalogo");
    await expect(page.getByRole("heading", { level: 1, name: "Catálogo" })).toBeVisible();
    const categories = page.getByRole("navigation", { name: "Compra por categoría" });
    await expect(categories.getByRole("link", { name: "Mujer" })).toBeVisible();
    await expect(categories.getByRole("link", { name: "Hombre" })).toBeVisible();
    await expect(page.locator("article")).toHaveCount(4);
    // Producto en oferta: muestra el descuento (S/ 90 → S/ 70)
    const skinny = page.locator("article").filter({ hasText: PRODUCTS.skinny.name });
    await expect(skinny).toContainText("-22%");
  });

  test("filtra por talla, muestra el filtro como chip y se quita desde el chip", async ({ page }) => {
    await page.goto("/catalogo");
    const panel = await filterPanel(page);
    // Se reintenta: un clic dado antes de que React termine de hidratar la página no se aplica
    await expect(async () => {
      if (!/talla=S/.test(page.url())) await panel.getByRole("button", { name: "S", exact: true }).click({ timeout: 10_000 });
      await expect(page).toHaveURL(/talla=S/, { timeout: 10_000 });
    }).toPass({ timeout: 90_000 });
    await expect(page.locator("article")).toHaveCount(1);
    await expect(page.locator("article")).toContainText(PRODUCTS.skinny.name);

    // En móvil el cajón sigue abierto: se cierra para ver los chips
    if ((page.viewportSize()?.width ?? 1280) < 1024) await panel.getByRole("button", { name: /^Ver \d+ producto/ }).click();
    const chips = page.getByRole("list", { name: "Filtros activos" });
    await expect(chips).toContainText("Talla S");
    await expect(async () => {
      if (/talla=/.test(page.url())) await chips.getByRole("button", { name: "Quitar filtro Talla S" }).click({ timeout: 10_000 });
      await expect(page).not.toHaveURL(/talla=/, { timeout: 10_000 });
    }).toPass({ timeout: 90_000 });
    await expect(page.locator("article")).toHaveCount(4);
    await expect(chips).toHaveCount(0);
  });

  test("el filtro de precio muestra lo que se escribe y se aplica", async ({ page }) => {
    await page.goto("/catalogo");
    const panel = await filterPanel(page);
    const min = panel.getByLabel("Precio mínimo");
    await min.fill("125");
    await expect(min).toHaveValue("125");
    // Regresión: la caja era tan angosta que las flechas del navegador tapaban el número
    expect((await min.boundingBox())!.width).toBeGreaterThan(70);
    await expect(async () => {
      if (!/min=125/.test(page.url())) await panel.getByRole("button", { name: "Aplicar precio" }).click({ timeout: 10_000 });
      await expect(page).toHaveURL(/min=125/, { timeout: 15_000 });
    }).toPass({ timeout: 90_000 });
    await expect(page.locator("article")).toHaveCount(1); // solo la camisa de S/ 150
  });

  test("ordena por precio de menor a mayor", async ({ page }) => {
    await page.goto("/catalogo");
    // Se reintenta: un cambio hecho antes de que React termine de hidratar la página no se aplica
    await expect(async () => {
      // Se alterna con otro valor para que cada intento dispare un cambio real (repetir el mismo valor no dispara nada)
      await page.getByLabel("Ordenar por").selectOption(/orden=/.test(page.url()) ? "vendidos" : "precio-desc");
      await page.getByLabel("Ordenar por").selectOption("precio-asc");
      await expect(page).toHaveURL(/orden=precio-asc/, { timeout: 15_000 });
    }).toPass({ timeout: 90_000 });
    await expect(page.locator("article").first()).toContainText(PRODUCTS.skinny.name); // S/ 70, el más barato
  });

  test("la fila de categorías lleva a esa categoría", async ({ page }) => {
    await page.goto("/catalogo");
    await page.getByRole("navigation", { name: "Compra por categoría" }).getByRole("link", { name: "Hombre" }).click();
    await expect(page).toHaveURL(/categoria=hombre/);
    await expect(page.locator("article")).toHaveCount(1);
    await expect(page.locator("article")).toContainText(PRODUCTS.hombre.name);
  });

  test("cambia la densidad de la cuadrícula sin recargar", async ({ page }) => {
    await page.goto("/catalogo");
    await expect(page.locator('[data-density="compact"]')).toBeVisible();
    await page.getByRole("button", { name: "Vista amplia" }).click();
    await expect(page.locator('[data-density="wide"]')).toBeVisible();
    await page.getByRole("button", { name: "Vista compacta" }).click();
    await expect(page.locator('[data-density="compact"]')).toBeVisible();
  });

  test("una búsqueda sin resultados ofrece limpiar los filtros", async ({ page }) => {
    await page.goto("/catalogo?q=zzzzzz");
    await expect(page.getByText("No encontramos productos")).toBeVisible();
    await expect(async () => {
      if ((await page.locator("article").count()) < 4) await page.getByRole("link", { name: "Limpiar filtros" }).click({ timeout: 5_000 });
      await expect(page.locator("article")).toHaveCount(4, { timeout: 10_000 });
    }).toPass({ timeout: 90_000 });
  });
});
