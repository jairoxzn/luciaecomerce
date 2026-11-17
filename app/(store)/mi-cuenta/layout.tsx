import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { AccountNav } from "@/components/account/account-nav";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/mi-cuenta");
  return (
    <div className="container-page py-8 sm:py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-stone">Mi cuenta</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Hola, {user.name.split(" ")[0]}</h1>
          <p className="text-sm text-stone">{user.email}</p>
        </div>
        {user.role === "ADMIN" && <Link href="/admin/dashboard" className="text-sm font-semibold text-brand hover:underline">Ir al panel administrativo →</Link>}
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-[240px_1fr]">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
