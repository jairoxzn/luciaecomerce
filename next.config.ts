import type { NextConfig } from "next";

// Imágenes remotas permitidas en next/image: Vercel Blob y, opcionalmente, el bucket S3/CDN
const blobPattern = { protocol: "https" as const, hostname: "*.public.blob.vercel-storage.com", port: "", pathname: "/**" };

function s3Pattern() {
  const base = process.env.S3_PUBLIC_BASE_URL;
  if (!base) return [blobPattern];
  try {
    const u = new URL(base);
    return [
      blobPattern,
      {
        protocol: u.protocol.replace(":", "") as "http" | "https",
        hostname: u.hostname,
        port: u.port,
        pathname: "/**",
      },
    ];
  } catch {
    return [blobPattern];
  }
}

const STATIC_CACHE = "public, max-age=2592000, stale-while-revalidate=604800";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Permite compilar en otra carpeta sin pisar `.next` del servidor de desarrollo (NEXT_DIST_DIR=.next-build)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client", "pdfkit", "exceljs", "sharp"],
  images: {
    // next/image convierte automáticamente a AVIF/WebP y genera tamaños por dispositivo
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 480, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [64, 96, 128, 192, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    qualities: [60, 75, 85, 90],
    remotePatterns: s3Pattern(),
  },
  // pdfkit lee sus fuentes (.afm) del disco en tiempo de ejecución: se incluyen en el build standalone
  outputFileTracingIncludes: {
    "/api/admin/reports/export": ["./node_modules/pdfkit/js/data/**/*"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Estáticos de /public: el navegador y la CDN los reutilizan 30 días y los revalidan en segundo plano una semana más.
      // (No son «immutable» porque conservan el mismo nombre: si reemplazas una imagen, renómbrala o espera a que expire.)
      { source: "/demo/:path*", headers: [{ key: "Cache-Control", value: STATIC_CACHE }] },
      { source: "/brand/:path*", headers: [{ key: "Cache-Control", value: STATIC_CACHE }] },
    ];
  },
};

export default nextConfig;
