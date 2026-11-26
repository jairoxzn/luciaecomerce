import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import path from "path";
import { PRODUCTS } from "./data";
import { addToCart, adminPage, confirmOrder, goToPaymentStep } from "./helpers";

test.describe("seguridad web: acciones, cookies y CSRF", () => {
  test("createResetLink no está publicada como Server Action", () => {
    const manifest = JSON.parse(readFileSync(path.resolve(__dirname, "../../.next-e2e/server/server-reference-manifest.json"), "utf8"));
    const exported = Object.values(manifest.node as Record<string, { exportedName?: string }>).map((v) => v.exportedName);
    expect(exported).toContain("loginAction"); // el manifiesto se leyó bien
    expect(exported).not.toContain("createResetLink");
  });

  test("las cookies de sesión y de invitado son HttpOnly, Secure y SameSite=Lax", async ({ page, browser }) => {
    const { ctx } = await adminPage(browser, test.info().project.use.baseURL);
    const session = (await ctx.cookies()).find((c) => c.name === "lj_session");
    expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
    await ctx.close();

    // Un invitado compra: recibe la cookie firmada de sus pedidos y puede ver la confirmación con ella
    await addToCart(page, PRODUCTS.jean.slug, PRODUCTS.jean.name, "L");
    await goToPaymentStep(page);
    await page.getByRole("radio", { name: /Contra entrega/ }).check();
    const code = await confirmOrder(page);
    await expect(page.getByText(code).first()).toBeVisible();
    const guest = (await page.context().cookies()).find((c) => c.name === "lj_guest_orders");
    expect(guest).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax" });
  });

  test("los route handlers rechazan otros orígenes, también con X-Forwarded-Host falsificado", async ({ request, baseURL }) => {
    const post = (headers: Record<string, string>) => request.post("/api/orders/NO-EXISTE/proof", { headers, multipart: { x: "1" } });
    expect((await post({ origin: "https://evil.example" })).status()).toBe(403);
    expect((await post({ origin: "https://evil.example", "x-forwarded-host": "evil.example" })).status()).toBe(403);
    expect((await post({ origin: new URL(baseURL!).origin })).status()).toBe(404); // pasa el control; el pedido no existe
  });

  test("el export de reportes no se dispara desde otro sitio, pero funciona desde el panel", async ({ browser }) => {
    const { ctx } = await adminPage(browser, test.info().project.use.baseURL);
    const url = "/api/admin/reports/export?tipo=ventas-diarias&formato=xlsx";
    const blocked = await ctx.request.get(url, { headers: { "sec-fetch-site": "cross-site" } });
    expect(blocked.status()).toBe(403);
    const page = await ctx.newPage();
    await page.goto("/admin/reportes");
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Excel" }).first().click();
    expect((await download).suggestedFilename()).toMatch(/\.xlsx$/);
    await ctx.close();
  });
});
