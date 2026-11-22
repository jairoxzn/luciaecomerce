import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "fs";
import path from "path";

/**
 * Pruebas E2E del flujo de compra. Seguridad: el servidor de pruebas y el seed usan SIEMPRE la base *_test
 * (TEST_DATABASE_URL_UNPOOLED del .env), nunca la base real; el seed se niega a correr si el nombre no termina en "_test".
 *
 *   npm run test:e2e              # compila (next build) y levanta el servidor en el puerto 3100; ejecuta todo
 *   npm run test:e2e -- --headed  # viendo el navegador
 *
 * Requiere Microsoft Edge o Chrome instalado (usa el del sistema, no descarga navegadores). Cambiar con E2E_CHANNEL=chrome.
 */
const root = __dirname;
const envPath = path.join(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}

const testDb = process.env.TEST_DATABASE_URL_UNPOOLED;
if (!testDb) throw new Error("Falta TEST_DATABASE_URL_UNPOOLED en .env: las pruebas E2E nunca se ejecutan contra la base real.");
// El seed (proceso de Playwright) y el servidor comparten la misma base de pruebas
// Neon suspende el cómputo cuando está inactivo y el primer intento puede tardar: se amplía el tiempo de conexión de Prisma (por defecto 5 s)
const dbUrl = testDb + (testDb.includes("?") ? "&" : "?") + "connect_timeout=30&pool_timeout=30";
process.env.DATABASE_URL = dbUrl;
process.env.DATABASE_URL_UNPOOLED = dbUrl;

const PORT = 3100;
const channel = process.env.E2E_CHANNEL || "msedge";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts/,
  globalSetup: "./tests/e2e/global-setup.ts",
  // Una sola base compartida: los casos corren en serie
  fullyParallel: false,
  workers: 1,
  // Un reintento: contra una base remota algún clic puede perderse; un fallo real falla también en el reintento
  retries: 1,
  // La base de pruebas es remota (Neon) y `next dev` compila cada ruta la primera vez: los tiempos son holgados a propósito
  timeout: 240_000,
  expect: { timeout: 60_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "es-PE",
    timezoneId: "America/Lima",
    channel,
    navigationTimeout: 120_000,
    actionTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"], channel, viewport: { width: 1280, height: 900 } } },
    { name: "movil", testMatch: /catalog\.spec\.ts/, use: { ...devices["Pixel 7"], channel } },
  ],
  webServer: {
    // Build de producción en carpeta aparte: es más rápido y estable que `next dev` (que compila cada ruta al visitarla)
    command: `npx next build && npx next start --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 600_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      DATABASE_URL: dbUrl,
      DATABASE_URL_UNPOOLED: dbUrl,
      NEXT_DIST_DIR: ".next-e2e", // no pisa el build ni el `next dev` normal
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      AUTH_SECRET: process.env.AUTH_SECRET || "e2e-secret-e2e-secret-e2e-secret-e2e",
      STORAGE_DRIVER: "local",
      UPLOAD_DIR: path.join(root, ".test-storage-e2e"),
      BLOB_READ_WRITE_TOKEN: "",
      REDIS_URL: "",
      // Sin correo ni WhatsApp: ninguna prueba envía mensajes reales
      SMTP_HOST: "",
      SMTP_USER: "",
      SMTP_PASS: "",
      WHATSAPP_PHONE_NUMBER_ID: "",
      WHATSAPP_ACCESS_TOKEN: "",
    },
  },
});
