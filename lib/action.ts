import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/guards";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Error con mensaje seguro para mostrar al usuario. */
export class UserError extends Error {}

/** Convierte excepciones en resultados seguros para el cliente (sin filtrar detalles internos). */
export function toFail(e: unknown): { ok: false; error: string; fieldErrors?: Record<string, string[]> } {
  if (e instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of e.issues) {
      const k = issue.path.join(".") || "_";
      (fieldErrors[k] ||= []).push(issue.message);
    }
    return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos.", fieldErrors };
  }
  if (e instanceof UserError || e instanceof AuthError) return { ok: false, error: e.message };
  const code = (e as { code?: string })?.code;
  if (code === "P2002") return { ok: false, error: "Ya existe un registro con esos datos (valor duplicado)." };
  if (code === "P2003") return { ok: false, error: "No se puede completar: el registro está en uso por otros datos." };
  if (code === "P2025") return { ok: false, error: "El registro ya no existe." };
  console.error("[action] error inesperado", e);
  return { ok: false, error: "Ocurrió un error inesperado. Inténtalo nuevamente." };
}

export async function run<T = undefined>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    return toFail(e);
  }
}
