import { readFileSync, existsSync } from "fs";
import path from "path";
import { vi } from "vitest";

// Carga .env y redirige la BD a la base de pruebas (NUNCA a los datos reales)
const envPath = path.resolve(__dirname, "../.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}
// Las pruebas usan una BASE DE DATOS separada (neondb_test) por conexión directa. Nunca la base real.
if (process.env.TEST_DATABASE_URL_UNPOOLED) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL_UNPOOLED;
  process.env.DATABASE_URL_UNPOOLED = process.env.TEST_DATABASE_URL_UNPOOLED;
}
process.env.AUTH_SECRET ||= "test-secret-test-secret-test-secret";
process.env.UPLOAD_DIR = path.resolve(__dirname, "../.test-storage");
process.env.STORAGE_DRIVER = "local";

// next/cache fuera de Next: sin caché
vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...a: never[]) => unknown>(fn: T) => fn,
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
}));
