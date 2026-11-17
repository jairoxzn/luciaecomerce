"use server";

import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/auth/guards";

export async function markNotificationsReadAction() {
  await assertAdmin();
  await prisma.notification.updateMany({ where: { forAdmin: true, readAt: null }, data: { readAt: new Date() } });
}
