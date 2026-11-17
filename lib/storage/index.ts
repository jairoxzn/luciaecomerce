import "server-only";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { del as blobDel, head as blobHead, put as blobPut } from "@vercel/blob";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { UserError } from "@/lib/action";

/**
 * Almacenamiento de archivos (nunca en PostgreSQL). Drivers:
 *  - local → carpeta UPLOAD_DIR (VPS/Docker con volumen persistente). NO funciona en Vercel (disco de solo lectura).
 *  - s3    → cualquier servicio S3-compatible (AWS S3, Cloudflare R2, MinIO, Backblaze…)
 *  - blob  → Vercel Blob (variable BLOB_READ_WRITE_TOKEN; en Vercel se elige solo si existe el token)
 *
 * Carpetas públicas (se sirven por URL pública): products, banners, categories, branding.
 * Carpeta privada: proofs (comprobantes) → solo se leen por rutas autenticadas; su URL nunca se expone.
 */

export type PublicFolder = "products" | "banners" | "categories" | "branding";
export const PUBLIC_FOLDERS: readonly string[] = ["products", "banners", "categories", "branding"];

type Driver = "local" | "s3" | "blob";
const onVercel = () => !!process.env.VERCEL;

function driver(): Driver {
  const d = process.env.STORAGE_DRIVER;
  if (d === "s3") return "s3";
  if (d === "blob") return "blob";
  // En Vercel, si hay token de Blob se usa automáticamente (aunque STORAGE_DRIVER siga en "local")
  if (onVercel() && process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  return "local";
}
const uploadDir = () => path.resolve(process.env.UPLOAD_DIR || "./storage");

const NOT_CONFIGURED_VERCEL =
  "El almacenamiento de imágenes no está configurado en Vercel. En Vercel → Storage crea un Blob store y conéctalo al proyecto (variable BLOB_READ_WRITE_TOKEN), o configura S3 (STORAGE_DRIVER=s3 y variables S3_*). Luego vuelve a desplegar.";

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
  const d = driver();
  if (d === "blob") {
    const ok = !!process.env.BLOB_READ_WRITE_TOKEN;
    return { driver: "blob" as const, configured: ok, detail: ok ? "Vercel Blob" : "Falta BLOB_READ_WRITE_TOKEN" };
  }
  if (d === "s3") {
    const ok = !!(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
    return { driver: "s3" as const, configured: ok, detail: ok ? `Bucket: ${process.env.S3_BUCKET}` : "Faltan variables S3_*" };
  }
  if (onVercel()) return { driver: "local" as const, configured: false, detail: "En Vercel el disco es de solo lectura: conecta Vercel Blob o S3" };
  return { driver: "local" as const, configured: true, detail: `Carpeta: ${uploadDir()}` };
}

function safeLocalPath(key: string) {
  const root = uploadDir();
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new UserError("Ruta de archivo inválida.");
  return full;
}

/** Guarda un objeto. Devuelve la URL pública cuando el driver la entrega (blob). */
async function putObject(key: string, body: Buffer, contentType: string): Promise<{ url?: string }> {
  const d = driver();
  if (d === "blob") {
    try {
      const r = await blobPut(key, body, { access: "public", addRandomSuffix: false, allowOverwrite: false, contentType });
      return { url: r.url };
    } catch (e) {
      console.error("[storage] Vercel Blob", e);
      throw new UserError("No se pudo guardar el archivo en Vercel Blob. Revisa BLOB_READ_WRITE_TOKEN.");
    }
  }
  if (d === "s3") {
    await s3().send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key, Body: body, ContentType: contentType }));
    return {};
  }
  if (onVercel()) throw new UserError(NOT_CONFIGURED_VERCEL);
  const full = safeLocalPath(key);
  try {
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
  } catch (e) {
    const code = (e as { code?: string }).code;
    console.error("[storage] escritura local", e);
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      throw new UserError("No se puede escribir en la carpeta de archivos (solo lectura o sin permisos). Revisa UPLOAD_DIR o usa S3 / Vercel Blob.");
    }
    throw e;
  }
  return {};
}

export async function readObject(key: string): Promise<{ body: Buffer; contentType: string } | null> {
  try {
    const d = driver();
    if (d === "blob") {
      const meta = await blobHead(key);
      const res = await fetch(meta.url, { cache: "no-store" });
      if (!res.ok) return null;
      return { body: Buffer.from(await res.arrayBuffer()), contentType: meta.contentType || guessType(key) };
    }
    if (d === "s3") {
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
    const d = driver();
    if (d === "blob") await blobDel(urlOrKey && /^https?:\/\//.test(urlOrKey) ? urlOrKey : key);
    else if (d === "s3") await s3().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }));
    else await fs.unlink(safeLocalPath(key));
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
  try {
    const u = new URL(url);
    if (u.hostname.endsWith(".public.blob.vercel-storage.com")) return decodeURIComponent(u.pathname.replace(/^\//, ""));
  } catch {
    /* no es una URL */
  }
  return null;
}

function publicUrl(key: string, direct?: string) {
  if (direct) return direct;
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
// 4 MB: Vercel rechaza cuerpos de petición mayores a ~4,5 MB
export const MAX_PROOF_BYTES = 4 * 1024 * 1024;

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
  const stored = await putObject(key, out, "image/webp");
  return { key, url: publicUrl(key, stored.url) };
}

/** Comprobante de pago (privado): imagen o PDF validados por firma. */
export async function saveProof(file: File) {
  if (file.size > MAX_PROOF_BYTES) throw new UserError("El comprobante supera el tamaño máximo de 4 MB.");
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
