import type { Metadata, Viewport } from "next";
import { Dancing_Script, Poppins } from "next/font/google";
import { Toaster } from "sonner";
import { getSettings } from "@/lib/services/settings";
import "./globals.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"], variable: "--font-poppins", display: "swap" });
const script = Dancing_Script({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-script", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  // Si la BD no está disponible (p. ej. durante el build) se usan valores por defecto
  const s = await getSettings().catch(() => ({ storeName: "LUCIA JEANS", slogan: "Moda para todos. Viste tu estilo, siempre.", heroDescription: "Descubre las últimas tendencias en ropa para mujer, hombre y niños." }));
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return {
    metadataBase: new URL(site),
    title: { default: `${s.storeName} | Moda para todos`, template: `%s | ${s.storeName}` },
    description: `${s.slogan} ${s.heroDescription}`,
    applicationName: s.storeName,
    openGraph: {
      type: "website",
      locale: "es_PE",
      siteName: s.storeName,
      title: `${s.storeName} | Moda para todos`,
      description: s.heroDescription,
      images: [{ url: "/demo/hero-trio.webp", width: 1416, height: 1056, alt: s.storeName }],
    },
    twitter: { card: "summary_large_image" },
    alternates: { canonical: "/" },
  };
}

export const viewport: Viewport = {
  themeColor: "#E65385",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PE" className={`${poppins.variable} ${script.variable}`}>
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster position="top-center" richColors closeButton toastOptions={{ classNames: { toast: "font-sans" } }} />
      </body>
    </html>
  );
}
