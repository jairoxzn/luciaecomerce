import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

const slugify = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// ───────────── Catálogo base ─────────────
const CATEGORIES: { name: string; image: string; description: string; subs: string[] }[] = [
  { name: "Mujer", image: "/demo/top-rosa.webp", description: "Jeans, blusas, vestidos y más para tu estilo.", subs: ["Jeans", "Leggings", "Blusas", "Polos", "Vestidos", "Faldas", "Casacas", "Conjuntos", "Ropa deportiva"] },
  { name: "Hombre", image: "/demo/polo-negro.webp", description: "Moda urbana y casual para él.", subs: ["Jeans", "Polos", "Camisas", "Pantalones", "Buzos", "Casacas", "Shorts"] },
  { name: "Niños", image: "/demo/polo-nina.webp", description: "Comodidad y estilo para los más pequeños.", subs: ["Polos", "Pantalones", "Conjuntos", "Buzos", "Casacas"] },
  { name: "Accesorios", image: "/demo/gafas.webp", description: "El complemento perfecto para cada look.", subs: ["Carteras", "Gorros", "Cinturones", "Otros"] },
];

const SIZES: { name: string; order: number }[] = [
  ...["XS", "S", "M", "L", "XL"].map((n, i) => ({ name: n, order: i })),
  ...["26", "28", "30", "32", "34", "36"].map((n, i) => ({ name: n, order: 10 + i })),
  ...["2", "4", "6", "8", "10", "12", "14"].map((n, i) => ({ name: n, order: 20 + i })),
  { name: "Única", order: 40 },
];

const COLORS: { name: string; hex: string }[] = [
  { name: "Negro", hex: "#171717" },
  { name: "Blanco", hex: "#FFFFFF" },
  { name: "Rosa", hex: "#E65385" },
  { name: "Azul", hex: "#4F7CAC" },
  { name: "Azul oscuro", hex: "#1F3A5F" },
  { name: "Celeste", hex: "#A9CCE3" },
  { name: "Gris", hex: "#9CA3AF" },
  { name: "Beige", hex: "#D9C3A5" },
  { name: "Rojo", hex: "#C0392B" },
  { name: "Verde", hex: "#4D7C5B" },
  { name: "Marrón", hex: "#6B4A32" },
];

type SizeSet = "letters" | "jeans" | "kids" | "one";
const SIZE_SETS: Record<SizeSet, string[]> = {
  letters: ["XS", "S", "M", "L", "XL"],
  jeans: ["26", "28", "30", "32", "34"],
  kids: ["4", "6", "8", "10", "12"],
  one: ["Única"],
};

type P = {
  name: string; cat: string; sub: string; price: number; sale?: number; imgs: string[]; sizes: SizeSet; colors: string[];
  featured?: boolean; best?: boolean; isNew?: boolean; desc: string; material?: string;
};

const D = (f: string) => `/demo/${f}.webp`;

const PRODUCTS: P[] = [
  { name: "Jean Mom Fit Mujer", cat: "Mujer", sub: "Jeans", price: 89.9, sale: 69.9, imgs: ["jean-wide", "top-rosa"], sizes: "jeans", colors: ["Azul", "Negro"], featured: true, best: true, desc: "Jean mom fit de tiro alto y pierna recta. Cómodo, versátil y con el calce que está de moda.", material: "98% algodón, 2% elastano" },
  { name: "Jean Skinny Tiro Alto", cat: "Mujer", sub: "Jeans", price: 99.9, imgs: ["jean-wide"], sizes: "jeans", colors: ["Azul oscuro", "Negro"], isNew: true, desc: "Jean skinny elástico que estiliza la silueta. Tiro alto y acabado premium.", material: "92% algodón, 6% poliéster, 2% elastano" },
  { name: "Jean Wide Leg Mujer", cat: "Mujer", sub: "Jeans", price: 109.9, sale: 89.9, imgs: ["jean-wide", "casaca-jean"], sizes: "jeans", colors: ["Azul", "Celeste"], featured: true, desc: "Jean wide leg de caída amplia, tendencia absoluta de la temporada." },
  { name: "Legging Deportivo Básico", cat: "Mujer", sub: "Leggings", price: 39.9, imgs: ["top-rosa"], sizes: "letters", colors: ["Negro", "Gris"], best: true, desc: "Legging elástico de tiro alto, ideal para entrenar o para el día a día." },
  { name: "Legging Push Up", cat: "Mujer", sub: "Leggings", price: 49.9, imgs: ["top-rosa"], sizes: "letters", colors: ["Negro", "Azul oscuro"], isNew: true, desc: "Legging con costuras que realzan la silueta y gran ajuste." },
  { name: "Blusa Manga Larga Rosa", cat: "Mujer", sub: "Blusas", price: 59.9, imgs: ["blusa-rosa", "top-rosa"], sizes: "letters", colors: ["Rosa", "Blanco"], featured: true, isNew: true, desc: "Blusa de manga larga con detalle bordado. Suave al tacto y fácil de combinar." },
  { name: "Blusa Básica Crop", cat: "Mujer", sub: "Blusas", price: 44.9, imgs: ["top-rosa", "blusa-rosa"], sizes: "letters", colors: ["Rosa", "Negro", "Blanco"], desc: "Crop básico con escote cuadrado. Imprescindible en tu clóset." },
  { name: "Top Básico Mujer", cat: "Mujer", sub: "Polos", price: 39.9, sale: 29.9, imgs: ["top-rosa"], sizes: "letters", colors: ["Rosa", "Negro", "Blanco", "Beige"], featured: true, best: true, desc: "Top básico de alta calidad, tela suave y cómoda. Ideal para cualquier ocasión.", material: "95% algodón, 5% elastano" },
  { name: "Polo Oversize Mujer", cat: "Mujer", sub: "Polos", price: 39.9, imgs: ["polo-nina", "polo-negro"], sizes: "letters", colors: ["Blanco", "Negro"], isNew: true, desc: "Polo oversize de algodón con corte relajado." },
  { name: "Vestido Casual Midi", cat: "Mujer", sub: "Vestidos", price: 99.9, imgs: ["chaqueta-gris"], sizes: "letters", colors: ["Negro", "Beige"], desc: "Vestido midi de caída fluida para looks casuales y elegantes." },
  { name: "Vestido Verano Floral", cat: "Mujer", sub: "Vestidos", price: 89.9, sale: 74.9, imgs: ["blusa-rosa"], sizes: "letters", colors: ["Rosa", "Celeste"], desc: "Vestido ligero con estampado floral, perfecto para días soleados." },
  { name: "Falda Jean Mini", cat: "Mujer", sub: "Faldas", price: 59.9, imgs: ["jean-wide"], sizes: "jeans", colors: ["Azul", "Celeste"], desc: "Mini falda de jean con cierre frontal y acabado desgastado." },
  { name: "Falda Plisada", cat: "Mujer", sub: "Faldas", price: 64.9, imgs: ["chaqueta-gris"], sizes: "letters", colors: ["Negro", "Beige"], desc: "Falda plisada con elástico en la cintura. Movimiento y elegancia." },
  { name: "Casaca Jean Mujer", cat: "Mujer", sub: "Casacas", price: 129.9, sale: 99.9, imgs: ["casaca-jean", "top-rosa"], sizes: "letters", colors: ["Azul", "Celeste"], featured: true, best: true, desc: "Casaca de jean clásica con botones metálicos y bolsillos frontales.", material: "100% algodón" },
  { name: "Casaca Bomber Mujer", cat: "Mujer", sub: "Casacas", price: 139.9, imgs: ["chaqueta-gris"], sizes: "letters", colors: ["Negro", "Verde"], isNew: true, desc: "Bomber ligera con puños elásticos. Un básico urbano." },
  { name: "Conjunto Casual 2 Piezas", cat: "Mujer", sub: "Conjuntos", price: 119.9, imgs: ["top-rosa", "jean-wide"], sizes: "letters", colors: ["Rosa", "Gris"], desc: "Conjunto de dos piezas combinables, cómodo y con estilo." },
  { name: "Conjunto Deportivo Mujer", cat: "Mujer", sub: "Conjuntos", price: 99.9, imgs: ["top-rosa"], sizes: "letters", colors: ["Negro", "Rosa"], isNew: true, desc: "Top y legging a juego para entrenar con comodidad." },
  { name: "Top Deportivo Mujer", cat: "Mujer", sub: "Ropa deportiva", price: 34.9, imgs: ["top-rosa"], sizes: "letters", colors: ["Negro", "Rosa", "Gris"], desc: "Top deportivo con soporte medio y tela de secado rápido." },
  { name: "Short Deportivo Mujer", cat: "Mujer", sub: "Ropa deportiva", price: 29.9, imgs: ["jean-wide"], sizes: "letters", colors: ["Negro", "Azul oscuro"], desc: "Short elástico y liviano para tus entrenamientos." },
  { name: "Jean Slim Fit Hombre", cat: "Hombre", sub: "Jeans", price: 99.9, imgs: ["jean-wide"], sizes: "jeans", colors: ["Azul", "Negro"], featured: true, desc: "Jean slim fit con ligera elasticidad. Calce moderno y cómodo.", material: "98% algodón, 2% elastano" },
  { name: "Jean Recto Clásico", cat: "Hombre", sub: "Jeans", price: 94.9, sale: 79.9, imgs: ["jean-wide"], sizes: "jeans", colors: ["Azul oscuro", "Celeste"], desc: "Jean recto de corte clásico, resistente y atemporal." },
  { name: "Polo Oversize Hombre", cat: "Hombre", sub: "Polos", price: 49.9, imgs: ["polo-negro"], sizes: "letters", colors: ["Negro", "Blanco"], featured: true, best: true, desc: "Polo oversize de algodón premium con logo bordado. Ajuste cómodo y moderno.", material: "100% algodón pima" },
  { name: "Polo Básico Algodón Hombre", cat: "Hombre", sub: "Polos", price: 34.9, imgs: ["polo-negro"], sizes: "letters", colors: ["Negro", "Gris", "Azul oscuro"], desc: "Polo básico de algodón suave para todos los días." },
  { name: "Camisa Casual Manga Larga", cat: "Hombre", sub: "Camisas", price: 79.9, imgs: ["chaqueta-gris"], sizes: "letters", colors: ["Celeste", "Blanco"], desc: "Camisa casual de algodón con cuello clásico." },
  { name: "Pantalón Jogger Hombre", cat: "Hombre", sub: "Pantalones", price: 89.9, imgs: ["jean-wide"], sizes: "letters", colors: ["Negro", "Gris"], desc: "Jogger de tela french terry con puños elásticos." },
  { name: "Pantalón Cargo", cat: "Hombre", sub: "Pantalones", price: 99.9, imgs: ["jean-wide"], sizes: "jeans", colors: ["Verde", "Beige"], isNew: true, desc: "Pantalón cargo con bolsillos laterales. Estilo utilitario." },
  { name: "Buzo Oversize Hombre", cat: "Hombre", sub: "Buzos", price: 79.9, imgs: ["buzo-negro"], sizes: "letters", colors: ["Negro", "Gris"], featured: true, best: true, desc: "Buzo con capucha de corte oversize, interior afelpado.", material: "80% algodón, 20% poliéster" },
  { name: "Casaca Bomber Hombre", cat: "Hombre", sub: "Casacas", price: 149.9, imgs: ["buzo-negro"], sizes: "letters", colors: ["Negro", "Verde"], desc: "Casaca bomber con forro interior y bolsillos con cierre." },
  { name: "Short Jean Hombre", cat: "Hombre", sub: "Shorts", price: 59.9, imgs: ["jean-wide"], sizes: "jeans", colors: ["Azul", "Negro"], desc: "Short de jean a la rodilla, ideal para el verano." },
  { name: "Polo Niño Estampado", cat: "Niños", sub: "Polos", price: 24.9, imgs: ["polo-nina"], sizes: "kids", colors: ["Blanco", "Negro", "Rosa"], best: true, desc: "Polo de algodón con estampado divertido, suave para la piel de los niños." },
  { name: "Pantalón Jogger Niño", cat: "Niños", sub: "Pantalones", price: 49.9, imgs: ["jean-wide"], sizes: "kids", colors: ["Gris", "Negro"], desc: "Jogger cómodo con cintura elástica y cordón." },
  { name: "Conjunto Niño 2 Piezas", cat: "Niños", sub: "Conjuntos", price: 69.9, sale: 59.9, imgs: ["polo-nina", "polo-negro"], sizes: "kids", colors: ["Azul", "Gris"], isNew: true, desc: "Polo y short a juego. Listo para jugar." },
  { name: "Buzo Niña Rosa", cat: "Niños", sub: "Buzos", price: 59.9, imgs: ["blusa-rosa"], sizes: "kids", colors: ["Rosa", "Blanco"], desc: "Buzo suave y calentito con capucha." },
  { name: "Casaca Niño Impermeable", cat: "Niños", sub: "Casacas", price: 79.9, imgs: ["buzo-negro"], sizes: "kids", colors: ["Azul oscuro", "Rojo"], desc: "Casaca ligera con repelencia al agua y capucha ajustable." },
  { name: "Gafas de Sol Clásicas", cat: "Accesorios", sub: "Otros", price: 39.9, imgs: ["gafas"], sizes: "one", colors: ["Negro", "Marrón"], featured: true, desc: "Gafas de sol con protección UV400 y montura resistente." },
  { name: "Cartera Bandolera", cat: "Accesorios", sub: "Carteras", price: 79.9, imgs: ["gafas"], sizes: "one", colors: ["Negro", "Beige"], isNew: true, desc: "Cartera bandolera con correa ajustable y compartimientos internos." },
  { name: "Gorro Beanie", cat: "Accesorios", sub: "Gorros", price: 24.9, imgs: ["gafas"], sizes: "one", colors: ["Negro", "Gris", "Rosa"], desc: "Gorro tejido suave y abrigador." },
  { name: "Cinturón Clásico", cat: "Accesorios", sub: "Cinturones", price: 44.9, imgs: ["gafas"], sizes: "one", colors: ["Negro", "Marrón"], desc: "Cinturón con hebilla metálica, ideal para jeans y pantalones." },
];

const SIZE_GUIDE = [
  { title: "Mujer · Jeans y pantalones", headers: ["Talla", "Cintura (cm)", "Cadera (cm)"], rows: [["26", "64–66", "90–92"], ["28", "68–70", "94–96"], ["30", "72–74", "98–100"], ["32", "76–78", "102–104"], ["34", "80–82", "106–108"]] },
  { title: "Mujer y Hombre · Prendas superiores", headers: ["Talla", "Pecho (cm)", "Largo (cm)"], rows: [["XS", "82–86", "58"], ["S", "88–92", "60"], ["M", "94–98", "62"], ["L", "100–104", "64"], ["XL", "106–110", "66"]] },
  { title: "Niños", headers: ["Talla", "Edad aprox.", "Altura (cm)"], rows: [["4", "3–4 años", "98–104"], ["6", "5–6 años", "110–116"], ["8", "7–8 años", "122–128"], ["10", "9–10 años", "134–140"], ["12", "11–12 años", "146–152"]] },
];

const LEGAL = {
  shippingPolicy: "Realizamos envíos a todo el Perú. Los pedidos se despachan dentro de 24 a 48 horas hábiles tras confirmar el pago. El tiempo de entrega depende de la zona: Lima y Callao de 1 a 2 días hábiles; provincias de 3 a 7 días hábiles. Recibirás actualizaciones del estado de tu pedido en tu cuenta.\n\n(Texto de ejemplo: revísalo y adáptalo desde Admin → Configuración.)",
  returnPolicy: "Aceptamos cambios dentro de los 7 días posteriores a la recepción, siempre que la prenda esté sin uso, con etiquetas y en su empaque original. Para solicitar un cambio, escríbenos por WhatsApp o correo indicando tu código de pedido.\n\n(Texto de ejemplo: revísalo y adáptalo desde Admin → Configuración.)",
  privacyPolicy: "Tus datos personales se utilizan únicamente para procesar tus pedidos, la entrega y la atención postventa, conforme a la Ley N.° 29733 de Protección de Datos Personales. No vendemos ni compartimos tu información con terceros ajenos al servicio de entrega.\n\n(Texto de ejemplo: revísalo con tu asesor legal y edítalo desde Admin → Configuración.)",
  termsAndConditions: "Al realizar una compra aceptas estos términos. Los precios están expresados en soles (PEN) e incluyen IGV. La disponibilidad está sujeta al stock. El pedido se confirma cuando validamos tu pago.\n\n(Texto de ejemplo: revísalo con tu asesor legal y edítalo desde Admin → Configuración.)",
  aboutText: "LUCIA JEANS nació con una idea simple: que todos puedan vestir su estilo, siempre. Ofrecemos moda moderna, cómoda y accesible para mujeres, hombres y niños, con la confianza de una tienda peruana.\n\n(Texto de ejemplo: personalízalo desde Admin → Configuración.)",
};

async function main() {
  console.log("→ Sembrando datos iniciales…");

  // Tallas y colores
  for (const s of SIZES) await prisma.size.upsert({ where: { name: s.name }, update: { sortOrder: s.order }, create: { name: s.name, sortOrder: s.order } });
  for (const [i, c] of COLORS.entries()) await prisma.color.upsert({ where: { name: c.name }, update: { hex: c.hex, sortOrder: i }, create: { name: c.name, hex: c.hex, sortOrder: i } });

  // Categorías y subcategorías
  const catIds = new Map<string, string>();
  const subIds = new Map<string, string>();
  for (const [ci, c] of CATEGORIES.entries()) {
    const cat = await prisma.category.upsert({
      where: { slug: slugify(c.name) },
      update: {},
      create: { name: c.name, slug: slugify(c.name), description: c.description, imageUrl: c.image, sortOrder: ci },
    });
    catIds.set(c.name, cat.id);
    for (const [si, s] of c.subs.entries()) {
      const sub = await prisma.subcategory.upsert({
        where: { categoryId_slug: { categoryId: cat.id, slug: slugify(s) } },
        update: {},
        create: { categoryId: cat.id, name: s, slug: slugify(s), sortOrder: si },
      });
      subIds.set(`${c.name}/${s}`, sub.id);
    }
  }

  const sizeRows = await prisma.size.findMany();
  const colorRows = await prisma.color.findMany();
  const sizeId = new Map(sizeRows.map((s) => [s.name, s.id]));
  const colorId = new Map(colorRows.map((c) => [c.name, c.id]));

  // Productos de demostración (SKU "DEMO-…", isDemo = true)
  let created = 0;
  for (const [i, p] of PRODUCTS.entries()) {
    const sku = `DEMO-${String(i + 1).padStart(3, "0")}`;
    if (await prisma.product.findUnique({ where: { sku } })) continue;
    const slug = slugify(p.name);
    const variants: Prisma.ProductVariantCreateWithoutProductInput[] = [];
    p.colors.forEach((col, ci) => {
      SIZE_SETS[p.sizes].forEach((sz, si) => {
        const stock = (i * 7 + ci * 5 + si * 3) % 13; // determinista; incluye ceros y stock bajo
        variants.push({
          sku: `${sku}-${slugify(col).toUpperCase()}-${sz.toUpperCase()}`,
          stock,
          minStock: 3,
          size: { connect: { id: sizeId.get(sz)! } },
          color: { connect: { id: colorId.get(col)! } },
        });
      });
    });
    await prisma.product.create({
      data: {
        name: p.name,
        slug,
        sku,
        description: p.desc,
        material: p.material ?? null,
        careInstructions: "Lavar a máquina con agua fría. No usar blanqueador. Planchar a temperatura baja.",
        category: { connect: { id: catIds.get(p.cat)! } },
        subcategory: { connect: { id: subIds.get(`${p.cat}/${p.sub}`)! } },
        price: new Prisma.Decimal(p.price.toFixed(2)),
        salePrice: p.sale ? new Prisma.Decimal(p.sale.toFixed(2)) : null,
        status: "ACTIVE",
        isFeatured: !!p.featured,
        isBestSeller: !!p.best,
        isNew: !!p.isNew,
        isDemo: true,
        images: { create: p.imgs.map((f, idx) => ({ url: D(f), alt: p.name, sortOrder: idx })) },
        variants: { create: variants },
      },
    });
    created++;
  }
  console.log(`  ✓ ${created} productos demo creados (${PRODUCTS.length - created} ya existían)`);

  // Configuración de la tienda (datos editables desde Admin → Configuración)
  await prisma.storeSettings.upsert({
    where: { id: "main" },
    update: {},
    create: {
      id: "main",
      storeName: "LUCIA JEANS",
      slogan: "Moda para todos. Viste tu estilo, siempre.",
      heroDescription: "Descubre las últimas tendencias en ropa para mujer, hombre y niños.",
      phone: "933 614 207",
      whatsapp: "933614207",
      email: "contacto@luciajeans.com",
      address: "Av. Ejemplo 123, Arequipa",
      businessHours: "Lun - Dom: 9am - 8pm",
      pickupEnabled: true,
      pickupAddress: "Av. Ejemplo 123, Arequipa",
      pickupPrice: new Prisma.Decimal(0),
      // Yape / Plin / transferencia se activan en el panel cuando se registran los datos reales.
      yapeEnabled: false,
      plinEnabled: false,
      transferEnabled: false,
      codEnabled: true,
      paymentInstructions: "Realiza el pago por el monto exacto del pedido y sube la captura de tu comprobante. Validaremos tu pago en un plazo máximo de 24 horas.",
      defaultMinStock: 3,
      sizeGuide: SIZE_GUIDE as unknown as Prisma.InputJsonValue,
      ...LEGAL,
    },
  });

  // Zonas de envío
  if ((await prisma.shippingZone.count()) === 0) {
    await prisma.shippingZone.createMany({
      data: [
        { name: "Lima y Callao", departments: ["Lima", "Callao"], price: new Prisma.Decimal(10), freeShippingFrom: new Prisma.Decimal(200), estimatedDays: "1 a 2 días hábiles", sortOrder: 0 },
        { name: "Provincias", departments: ["Amazonas", "Áncash", "Apurímac", "Arequipa", "Ayacucho", "Cajamarca", "Cusco", "Huancavelica", "Huánuco", "Ica", "Junín", "La Libertad", "Lambayeque", "Loreto", "Madre de Dios", "Moquegua", "Pasco", "Piura", "Puno", "San Martín", "Tacna", "Tumbes", "Ucayali"], price: new Prisma.Decimal(18), freeShippingFrom: new Prisma.Decimal(300), estimatedDays: "3 a 7 días hábiles", sortOrder: 1 },
      ],
    });
  }

  // Cupones de ejemplo
  await prisma.coupon.upsert({
    where: { code: "BIENVENIDA10" },
    update: {},
    create: { code: "BIENVENIDA10", description: "10% de descuento en tu primera compra", discountType: "PERCENT", value: new Prisma.Decimal(10), minPurchase: new Prisma.Decimal(80), isPublic: true, isActive: true },
  });
  await prisma.coupon.upsert({
    where: { code: "AHORRA20" },
    update: {},
    create: { code: "AHORRA20", description: "S/ 20 de descuento en compras desde S/ 150", discountType: "FIXED", value: new Prisma.Decimal(20), minPurchase: new Prisma.Decimal(150), isPublic: true, isActive: true },
  });

  // Banners de ejemplo
  if ((await prisma.banner.count()) === 0) {
    await prisma.banner.createMany({
      data: [
        { title: "Moda para todos. Viste tu estilo, siempre.", subtitle: "Descubre las últimas tendencias en ropa para mujer, hombre y niños.", ctaLabel: "Comprar ahora", ctaHref: "/catalogo", imageUrl: "/demo/hero-trio.webp", position: "HERO", sortOrder: 0 },
        { title: "Nuevos ingresos", subtitle: "Looks frescos para toda la familia.", ctaLabel: "Ver novedades", ctaHref: "/catalogo?orden=recientes", imageUrl: "/demo/familia.webp", position: "HERO", sortOrder: 1 },
        { title: "Envíos a todo el Perú", subtitle: "Compra desde cualquier lugar", ctaLabel: "Ver condiciones", ctaHref: "/politicas/envios", imageUrl: "/demo/contacto.webp", position: "PROMO", sortOrder: 0 },
        { title: "Colección Denim", subtitle: "Jeans que lo cambian todo", ctaLabel: "Explorar", ctaHref: "/catalogo?categoria=mujer&subcategoria=jeans", imageUrl: "/demo/jean-wide.webp", position: "COLLECTION", sortOrder: 0 },
        { title: "Básicos esenciales", subtitle: "Polos y tops para cada día", ctaLabel: "Explorar", ctaHref: "/catalogo?categoria=hombre&subcategoria=polos", imageUrl: "/demo/polo-negro.webp", position: "COLLECTION", sortOrder: 1 },
        { title: "Estilo Kids", subtitle: "Comodidad para jugar", ctaLabel: "Explorar", ctaHref: "/catalogo?categoria=ninos", imageUrl: "/demo/polo-nina.webp", position: "COLLECTION", sortOrder: 2 },
      ],
    });
  }

  // Administrador inicial (variables de entorno; nunca contraseñas en el código)
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (email) {
    let password = process.env.ADMIN_PASSWORD;
    const exists = await prisma.user.findUnique({ where: { email } });
    if (!exists) {
      let generated = false;
      if (!password || password.length < 10) {
        password = randomBytes(12).toString("base64url");
        generated = true;
      }
      await prisma.user.create({
        data: { email, name: process.env.ADMIN_NAME || "Administrador", role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
      });
      console.log(`  ✓ Administrador creado: ${email}`);
      if (generated) console.log(`  ⚠ ADMIN_PASSWORD no estaba definido (o era corto). Contraseña generada (guárdala, no se vuelve a mostrar): ${password}`);
    } else {
      if (exists.role !== "ADMIN") await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
      console.log(`  ✓ Administrador ya existente: ${email} (no se modifica su contraseña)`);
    }
  } else {
    console.log("  ⚠ ADMIN_EMAIL no definido: no se creó administrador.");
  }

  console.log("✔ Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
