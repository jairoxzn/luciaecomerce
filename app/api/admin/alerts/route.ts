import { NextResponse } from "next/server";
import { assertAdmin, AuthError } from "@/lib/auth/guards";
import { getAdminAlerts } from "@/lib/services/admin-alerts";

export const dynamic = "force-dynamic";

/** Contadores y avisos del panel (solo ADMIN). El panel la consulta cada pocos segundos para avisar al instante. */
export async function GET() {
  try {
    await assertAdmin();
    return NextResponse.json({ ok: true, ...(await getAdminAlerts()) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.code === "UNAUTHENTICATED" ? 401 : 403 });
    return NextResponse.json({ ok: false, error: "No se pudo consultar." }, { status: 500 });
  }
}
