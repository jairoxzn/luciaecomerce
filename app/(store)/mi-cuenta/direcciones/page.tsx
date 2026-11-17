import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { AddressManager } from "@/components/account/address-manager";

export const metadata: Metadata = { title: "Mis direcciones", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const user = await requireUser("/mi-cuenta/direcciones");
  const [addresses, profile] = await Promise.all([
    prisma.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
    prisma.customerProfile.findUnique({ where: { userId: user.id } }),
  ]);
  return (
    <AddressManager
      defaults={{ recipient: user.name, phone: profile?.phone ?? "" }}
      addresses={addresses.map((a) => ({ id: a.id, label: a.label, recipient: a.recipient, phone: a.phone, department: a.department, province: a.province, district: a.district, line: a.line, reference: a.reference, isDefault: a.isDefault }))}
    />
  );
}
