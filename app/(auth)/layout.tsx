import Image from "next/image";
import Link from "next/link";
import { getSettings } from "@/lib/services/settings";
import { Logo } from "@/components/ui/logo";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand to-brand-dark lg:block">
        <Image src="/demo/hero-trio.webp" alt="" fill sizes="50vw" priority className="object-cover opacity-90 mix-blend-luminosity" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/90 via-brand/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <p className="font-script text-4xl font-semibold">Moda para todos</p>
          <p className="mt-1 text-3xl font-extrabold">Viste tu estilo, siempre.</p>
        </div>
      </div>
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo logoUrl={s.logoUrl} name={s.storeName} className="h-10" />
          <Link href="/" className="text-sm text-stone hover:text-brand">← Volver a la tienda</Link>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </div>
    </div>
  );
}
