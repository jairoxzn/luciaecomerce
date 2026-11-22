import { expect, test } from "@playwright/test";
import { PRODUCTS } from "./data";
import { adminPage } from "./helpers";

test.describe("avísame cuando haya stock", () => {
  test("el cliente se apunta a una talla agotada, el admin ve la demanda y al reponer la talla vuelve a venderse", async ({ page, browser }) => {
    const baseURL = test.info().project.use.baseURL;
    const p = PRODUCTS.agotado;

    // Talla agotada: se puede seleccionar y ofrece el aviso (en vez de quedar bloqueada)
    await page.goto(`/productos/${p.slug}`);
    await page.getByRole("button", { name: "L", exact: true }).click();
    await expect(page.getByText("Esta talla está agotada")).toBeVisible();
    await expect(page.getByRole("button", { name: "Agregar al carrito" })).toBeDisabled(); // sigue sin poder comprarse

    // Un dato inválido se rechaza con mensaje
    const field = page.getByLabel("Correo o celular para el aviso");
    await field.fill("no-es-un-correo@");
    await page.getByRole("button", { name: "Avísame" }).click();
    await expect(page.getByText(/correo válido|celular válido/).first()).toBeVisible();

    // Correo válido → confirmación
    await field.fill("espera@example.com");
    await page.getByRole("button", { name: "Avísame" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Te avisaremos apenas vuelva a haber stock" })).toBeVisible();

    // Otra talla, ahora con celular
    await page.getByRole("button", { name: "M", exact: true }).click();
    await page.getByLabel("Correo o celular para el aviso").fill("987654321");
    await page.getByRole("button", { name: "Avísame" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Te avisaremos apenas vuelva a haber stock" })).toBeVisible();

    // Administrador: la demanda aparece en «Qué reponer primero»
    const { ctx: adminCtx, page: admin } = await adminPage(browser, baseURL);
    await admin.goto("/admin/inventario");
    const demand = admin.locator("section").filter({ has: admin.getByRole("heading", { name: "Qué reponer primero" }) });
    await expect(demand).toContainText(p.name);
    await expect(demand.getByText("1 cliente espera")).toHaveCount(2);

    // Repone la talla L desde el inventario
    await admin.goto(`/admin/inventario?filtro=agotado`);
    const row = admin.getByRole("row").filter({ hasText: p.name }).filter({ hasText: "Negro · L" });
    await row.getByRole("button", { name: "Ajustar" }).click();
    await admin.getByLabel("Cantidad").fill("5");
    await admin.getByLabel("Motivo").fill("Reposición E2E");
    await admin.getByRole("button", { name: "Registrar" }).click();
    await expect(admin.getByText(/Stock actualizado: 5 unidades/)).toBeVisible();

    // La talla repuesta vuelve a poder comprarse
    await page.goto(`/productos/${p.slug}`);
    await page.getByRole("button", { name: "L", exact: true }).click();
    await expect(page.getByText("Stock disponible: 5 unidades")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Agregar al carrito/ }).first()).toBeEnabled();
    await adminCtx.close();
  });
});
