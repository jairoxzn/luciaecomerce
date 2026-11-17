import { afterEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { rm } from "fs/promises";
import { keyFromUrl, saveImage, storageStatus } from "@/lib/storage";

const saved = { ...process.env };
afterEach(async () => {
  process.env = { ...saved };
  await rm(process.env.UPLOAD_DIR!, { recursive: true, force: true });
});

async function png() {
  const buf = await sharp({ create: { width: 30, height: 40, channels: 3, background: "#e65385" } }).png().toBuffer();
  return new File([new Uint8Array(buf)], "x.png", { type: "image/png" });
}

describe("almacenamiento de imágenes", () => {
  it("en local guarda y devuelve una ruta /media", async () => {
    delete process.env.VERCEL;
    process.env.STORAGE_DRIVER = "local";
    const r = await saveImage(await png(), "products");
    expect(r.url).toMatch(/^\/media\/products\/.+\.webp$/);
    expect(storageStatus()).toMatchObject({ driver: "local", configured: true });
  });

  it("en Vercel sin Blob/S3 explica cómo configurarlo (no un error genérico)", async () => {
    process.env.VERCEL = "1";
    process.env.STORAGE_DRIVER = "local";
    delete process.env.BLOB_READ_WRITE_TOKEN;
    await expect(saveImage(await png(), "products")).rejects.toThrow(/Vercel.*Blob/);
    expect(storageStatus()).toMatchObject({ driver: "local", configured: false });
  });

  it("en Vercel con token se selecciona Vercel Blob automáticamente", () => {
    process.env.VERCEL = "1";
    process.env.STORAGE_DRIVER = "local";
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test_token";
    expect(storageStatus()).toMatchObject({ driver: "blob", configured: true });
  });

  it("keyFromUrl reconoce rutas /media y URLs de Vercel Blob; ignora recursos estáticos", () => {
    expect(keyFromUrl("/media/products/a.webp")).toBe("products/a.webp");
    expect(keyFromUrl("https://abc123.public.blob.vercel-storage.com/products/a.webp")).toBe("products/a.webp");
    expect(keyFromUrl("/demo/top-rosa.webp")).toBeNull();
    expect(keyFromUrl("https://otro-sitio.com/x.webp")).toBeNull();
  });
});
