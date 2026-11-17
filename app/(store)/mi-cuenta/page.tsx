import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guards";
import { ProfileForm, PasswordForm } from "@/components/account/profile-forms";

export const metadata: Metadata = { title: "Mi perfil", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser("/mi-cuenta");
  const profile = await prisma.customerProfile.findUnique({ where: { userId: user.id } });
  const [fn, ...ln] = user.name.split(" ");
  return (
    <div className="space-y-6">
      <ProfileForm email={user.email} defaults={{ firstName: profile?.firstName ?? fn, lastName: profile?.lastName ?? ln.join(" "), phone: profile?.phone ?? "", dni: profile?.dni ?? "" }} />
      <PasswordForm />
    </div>
  );
}
