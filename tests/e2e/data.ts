/** Datos sembrados por global-setup y usados por las pruebas E2E (base *_test). */
import path from "path";

/** Sesión de administrador guardada por global-setup (se reutiliza en los casos que necesitan el panel). */
export const ADMIN_STATE = path.resolve(__dirname, ".auth/admin.json");

export const ADMIN = { email: "e2e-admin@lucia.test", password: "E2e-Admin-2026!", name: "Admin E2E" };

export const PRODUCTS = {
  jean: { name: "Jean Mom Fit E2E", slug: "jean-mom-fit-e2e", price: 120 },
  skinny: { name: "Jean Skinny E2E", slug: "jean-skinny-e2e", price: 90, sale: 70 },
  hombre: { name: "Camisa Lino E2E", slug: "camisa-lino-e2e", price: 150 },
  agotado: { name: "Blusa Agotada E2E", slug: "blusa-agotada-e2e", price: 80 },
} as const;

export const CUSTOMER = { firstName: "Prueba", lastName: "Automática", phone: "987654321", email: "e2e-cliente@example.com" };
