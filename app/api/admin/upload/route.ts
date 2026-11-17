import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/csrf";
import { assertAdmin, AuthError } from "@/lib/auth/guards";
import { saveImage, type PublicFolder } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { toFail, UserError } from "@/lib/action";

const FOLDERS: PublicFolder[] = ["products", "banners", "categories", "branding"];

/** Subida de imágenes públicas desde el panel (solo ADMIN). Valida firma, tamaño y optimiza a WebP. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, error: "Solicitud no permitida." }, { status: 403 });
  try {
    const admin = await assertAdmin();
    if (!(await rateLimit(`upload:${admin.id}`, 120, 600))) throw new UserError("Demasiadas subidas. Espera unos minutos.");
    const form = await req.formData();
    const folder = String(form.get("folder") ?? "") as PublicFolder;
    if (!FOLDERS.includes(folder)) throw new UserError("Carpeta no permitida.");
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Selecciona un archivo.");
    const saved = await saveImage(file, folder, { maxWidth: folder === "banners" ? 2400 : 2000 });
    return NextResponse.json({ ok: true, url: saved.url });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.code === "UNAUTHENTICATED" ? 401 : 403 });
    const r = toFail(e);
    // Un cuerpo corrupto o cortado (conexión interrumpida) llega como error genérico: mensaje claro
    if (e instanceof TypeError) return NextResponse.json({ ok: false, error: "La subida se interrumpió. Inténtalo de nuevo." }, { status: 400 });
    return NextResponse.json(r, { status: 400 });
  }
}
