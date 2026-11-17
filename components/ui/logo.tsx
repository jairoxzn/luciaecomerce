import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Logotipo original de LUCIA JEANS (proporciones intactas).
 * `logoUrl` viene de Configuración; si no existe se usa el logo de marca incluido en /public/brand.
 * El contenedor define la altura (p. ej. className="h-10"); el ancho se ajusta automáticamente.
 */
export function Logo({
  logoUrl,
  tone = "pink",
  className,
  name = "LUCIA JEANS",
  priority,
}: {
  logoUrl?: string | null;
  tone?: "pink" | "white";
  className?: string;
  name?: string;
  priority?: boolean;
}) {
  const src = logoUrl || (tone === "white" ? "/brand/logo-white.png" : "/brand/logo-pink.png");
  const invert = logoUrl && tone === "white" ? "brightness-0 invert" : "";
  return (
    <Link href="/" aria-label={`${name} — Inicio`} className={cn("inline-flex shrink-0 items-center", className)}>
      <Image src={src} alt={name} width={1213} height={425} priority={priority} className={cn("h-full w-auto object-contain", invert)} sizes="220px" />
    </Link>
  );
}
