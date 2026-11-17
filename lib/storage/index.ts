import "server-only";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { UserError } from "@/lib/action";

/**
 * Almacenamiento de archivos (nunca en PostgreSQL).
 *  - STORAGE_DRIVER=local → carpeta UPLOAD_DIR (montar volumen persistente en producción)
 *  - STORAGE_DRIVER=s3    → cualquier servicio S3-compatible (AWS S3, Cloudflare R2, MinIO, Backblaze…)
 *
 * Carpetas públicas (se sirven por /media): products, banners, categories, branding.
 * Carpeta privada: proofs (comprobantes) → solo se leen por rutas autenticadas.
 */

export type PublicFolder = "products" | "banners" | "categories" | "branding";
export const PUBLIC_FOLDERS: readonly string[] = ["products", "banners", "categories", "branding"];

const driver = () => (process.env.STORAGE_DRIVER === "s3" ? "s3" : "local");
const uploadDir = () => path.resolve(process.env.UPLOAD_DIR || "./storage");

let s3Client: S3Client | null = null;
function s3() {
  if (!s3Client) {
    const { S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
    if (!S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
      throw new UserError("El almacenamiento S3 no está configurado. Revisa las variables S3_* en el entorno.");
    }
    s3Client = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: !!process.env.S3_ENDPOINT,
      credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
    });
  }
  return s3Client;
}

export function storageStatus() {
  if (driver() === "local") return { driver: "local" as const, configured: true, detail: `Carpeta: ${uploadDir()}` };
  const ok = !!(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
  return { driver: "s3" as const, configured: ok, detail: ok ? `Bucket: ${process.env.S3_BUCKET}` : "Faltan variables S3_*" };
}

async function putObject(key: string, body: Buffer, contentType: string) {
  if (driver() === "s3") {
    await s3().send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key, Body: body, ContentType: contentType }));
    return;
  }
  const full = safeLocalPath(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body);
}

function safeLocalPath(key: string) {
  const root = uploadDir();
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new UserError("Ruta de archivo inválida.");
  return full;
}

export async function readObject(key: string): Promise<{ body: Buffer; contentType: string } | null> {
  try {
    if (driver() === "s3") {
      const res = await s3().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }));
      const bytes = await res.Body?.transformToByteArray();
      if (!bytes) return null;
      return { body: Buffer.from(bytes), contentType: res.ContentType || guessType(key) };
    }
    const body = await fs.readFile(safeLocalPath(key));
    return { body, contentType: guessType(key) };
  } catch {
    return null;
  }
}

export async function deleteByUrlOrKey(urlOrKey: string | null | undefined) {
  const key = keyFromUrl(urlOrKey);
  if (!key) return;
  try {
    if (driver() === "s3") {
      await s3().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }));
    } else {
      await fs.unlink(safeLocalPath(key));
    }
  } catch {
    /* archivo ya inexistente */
  }
}

function guessType(key: string) {
  const ext = path.extname(key).toLowerCase();
  return (
    { ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".pdf": "application/pdf" } as Record<string, string>
  )[ext] ?? "application/octet-stream";
}

/** URL pública (o ruta /media) → clave de almacenamiento. null si es un recurso estático (/demo, /brand) o externo. */
export function keyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/media/")) return url.slice("/media/".length);
  const base = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (base && url.startsWith(base + "/")) return url.slice(base.length + 1);
  return null;
}

function publicUrl(key: string) {
  const base = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (driver() === "s3" && base) return `${base}/${key}`;
  return `/media/${key}`;
}

// ───────────── Validación de archivos (por firma binaria, no por extensión) ─────────────

type Detected = "jpeg" | "png" | "webp" | "avif" | "gif" | "pdf";
function detect(buf: Buffer): Detected | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  const gif = buf.subarray(0, 6).toString("ascii");
  if (gif === "GIF87a" || gif === "GIF89a") return "gif";
  if (buf.subarray(4, 8).toString("ascii") === "ftyp" && ["avif", "avis"].includes(buf.subarray(8, 12).toString("ascii"))) return "avif";
  return null;
}

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

/** Imagen pública (producto, banner, categoría…): valida, quita metadatos y optimiza a WebP. */
export async function saveImage(file: File, folder: PublicFolder, opts?: { maxWidth?: number }) {
  if (file.size > MAX_IMAGE_BYTES) throw new UserError("La imagen supera el tamaño máximo de 8 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = detect(buf);
  if (!kind || kind === "pdf") throw new UserError("Formato de imagen no permitido. Usa JPG, PNG, WebP, AVIF o GIF.");
  let out: Buffer;
  try {
    out = await sharp(buf, { limitInputPixels: 60_000_000 })
      .rotate()
      .resize({ width: opts?.maxWidth ?? 2000, withoutEnlargement: true })
      .webp({ quality: 86 })
      .toBuffer();
  } catch {
    throw new UserError("No se pudo procesar la imagen. El archivo puede estar dañado.");
  }
  const key = `${folder}/${randomUUID()}.webp`;
  await putObject(key, out, "image/webp");
  return { key, url: publicUrl(key) };
}

/** Comprobante de pago (privado): imagen o PDF validados por firma. */
export async function saveProof(file: File) {
  if (file.size > MAX_PROOF_BYTES) throw new UserError("El comprobante supera el tamaño máximo de 5 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = detect(buf);
  if (!kind || kind === "avif" || kind === "gif") throw new UserError("Formato no permitido. Sube una imagen (JPG, PNG, WebP) o un PDF.");
  let out = buf;
  let mime = kind === "pdf" ? "application/pdf" : `image/${kind}`;
  let ext: string = kind === "jpeg" ? "jpg" : kind;
  if (kind !== "pdf") {
    try {
      out = await sharp(buf, { limitInputPixels: 60_000_000 }).rotate().resize({ width: 2200, withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
      mime = "image/webp";
      ext = "webp";
    } catch {
      throw new UserError("No se pudo procesar la imagen del comprobante.");
    }
  }
  const key = `proofs/${randomUUID()}.${ext}`;
  await putObject(key, out, mime);
  return { key, mimeType: mime, sizeBytes: out.length };
}
