import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Registro de operaciones administrativas. */
export async function logAudit(
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  meta?: Prisma.InputJsonValue,
) {
  try {
    const h = await headers();
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId: entityId ?? null,
        meta: meta ?? undefined,
        ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      },
    });
  } catch (e) {
    console.error("[audit] no se pudo registrar", e);
  }
}
