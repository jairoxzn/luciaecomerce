# LUCIA JEANS · E-commerce

Tienda online de moda (mujer, hombre, niños y accesorios) para el mercado peruano. Moneda **PEN (S/)**, idioma **español**, zona horaria **America/Lima**.

> *Moda para todos. Viste tu estilo, siempre.*

Sistema funcional con base de datos real: catálogo con variantes (talla/color), carrito, checkout por pasos, pagos manuales (Yape / Plin / transferencia / contra entrega) con validación administrativa de comprobantes, gestión de pedidos e inventario, cupones, promociones, banners, reportes (Excel/PDF), notificaciones y panel administrativo.

---

## 1. Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Lucide · `next/image` (AVIF/WebP) |
| Backend | Route Handlers + Server Actions · Zod 4 · arquitectura modular en `lib/services` |
| Datos | PostgreSQL (Neon) · Prisma 6 |
| Formularios/estado | React Hook Form · Zod · Zustand (carrito, favoritos) |
| Auth | Sesiones propias en BD (cookie `httpOnly`, token HMAC-SHA256 hasheado) · bcrypt (costo 12) · 2 roles: `ADMIN`, `CUSTOMER` |
| Archivos | Almacenamiento configurable: **Vercel Blob**, **S3-compatible** (AWS S3, Cloudflare R2, MinIO, Backblaze…) o **local** (VPS/Docker con volumen). Nunca en PostgreSQL |
| Reportes | exceljs (Excel) · pdfkit (PDF) |
| Pruebas | Vitest (unitarias + integración contra esquema aislado) |

Restricciones respetadas: sin Mercado Pago, sin Stripe, sin Cloudinary, sin funcionalidades SaaS, solo dos roles.

## 2. Requisitos

- Node.js ≥ 20.9 (probado con 22) y npm
- Una base PostgreSQL en [Neon](https://neon.tech) (o cualquier PostgreSQL 14+)
- Docker (opcional, para despliegue en contenedor)

## 3. Instalación local

```bash
npm install                      # instala dependencias y genera el cliente Prisma
cp .env.example .env             # y completa los valores (ver §4)
npx prisma migrate deploy        # aplica las migraciones
npm run db:seed                  # categorías, tallas, colores, 38 productos demo, config, envíos, cupones, banners y admin
npm run dev                      # http://localhost:3000
```

El seed crea el administrador con `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Si `ADMIN_PASSWORD` está vacío (o tiene menos de 10 caracteres) genera una contraseña aleatoria y **la imprime una sola vez** en la consola. Nunca hay contraseñas en el código ni en el repositorio.

Panel: `/admin/dashboard` (inicia sesión en `/login`).

### Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Desarrollo (Turbopack) |
| `npm run build` / `npm start` | Build y ejecución de producción |
| `npm run typecheck` · `npm run lint` | Tipos y lint |
| `npm test` | Todas las pruebas · `test:unit` · `test:integration` |
| `npm run db:migrate` | Nueva migración (desarrollo) |
| `npm run db:deploy` | Aplica migraciones (producción) |
| `npm run db:seed` | Datos iniciales (idempotente) |
| `npm run db:studio` | Prisma Studio |

## 4. Variables de entorno

Ver [`.env.example`](.env.example). Resumen:

| Variable | Obligatoria | Uso |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión **pooler** de Neon (runtime). Incluye `pgbouncer=true&connect_timeout=15&connection_limit=25&pool_timeout=30` |
| `DATABASE_URL_UNPOOLED` | Sí | Conexión **directa** de Neon (migraciones de Prisma) |
| `NEXT_PUBLIC_SITE_URL` | Sí | URL pública (`https://…`): SEO, sitemap, cookies `Secure` |
| `AUTH_SECRET` | Sí | ≥16 caracteres. Firma tokens/cookies. `openssl rand -base64 32` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Solo seed | Administrador inicial |
| `STORAGE_DRIVER` | No | `local` (por defecto) o `s3` |
| `UPLOAD_DIR` | local | Carpeta persistente (`./storage`; en Docker `/app/storage`) |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_ENDPOINT`, `S3_PUBLIC_BASE_URL` | s3 | Almacenamiento S3-compatible |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | No | Correo de recuperación de contraseña |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` | No | WhatsApp Cloud API (Meta) |

**Estados claros cuando algo no está configurado** (nunca se simula):
- Sin SMTP → el formulario de recuperación avisa que el envío no está configurado y el administrador puede generar el enlace desde *Clientes → ficha del cliente*.
- Sin WhatsApp → los avisos a clientes se registran como «No enviado» y el panel ofrece un enlace `wa.me` con el mensaje prellenado.
- Yape/Plin/transferencia no se activan sin sus datos (número/cuenta); el checkout solo muestra los métodos habilitados.

## 5. Neon + Prisma

1. En Neon: *Dashboard → Connect* y copia las dos cadenas (pooled y direct).
2. `DATABASE_URL` = pooled + `&pgbouncer=true&connect_timeout=15&connection_limit=25&pool_timeout=30`; `DATABASE_URL_UNPOOLED` = direct.
3. `schema.prisma` usa `url` (pooler) y `directUrl` (migraciones).
4. Migraciones en `prisma/migrations`. La migración inicial añade **restricciones CHECK** (stock ≥ 0, precios ≥ 0, oferta ≤ precio, cantidades > 0) como última barrera de integridad.
5. `prisma migrate deploy` en cada despliegue (el contenedor lo hace con `RUN_MIGRATIONS=true`).

### Modelo de datos
`User · CustomerProfile · Address · Session · PasswordResetToken · Category · Subcategory · Size · Color · Product · ProductImage · ProductVariant · InventoryMovement · Cart · CartItem · Favorite · Order · OrderItem · OrderStatusHistory · Payment · PaymentProof · Coupon · Promotion · Banner · ShippingZone · StoreSettings · Notification · AuditLog · ContactMessage · RateLimit`

## 6. Imágenes y almacenamiento

- **Optimización**: todas las imágenes de catálogo pasan por `next/image` → se sirven en **AVIF/WebP** con tamaños adaptados al dispositivo (`next.config.ts` → `images`), lazy loading y caché de 30 días.
- **Subidas del admin**: se validan por **firma binaria** (no por extensión), máx. 8 MB, se re-codifican a WebP (quita EXIF) y se guardan con nombre UUID en `products/`, `banners/`, `categories/`, `branding/`.
- **Comprobantes de pago**: carpeta privada `proofs/` (máx. 4 MB; imagen o PDF). Solo se leen por `/api/proofs/[id]` con autorización (administrador o dueño del pedido). **Nunca** se sirven públicamente.
- Archivos públicos se sirven por `/media/*` (local) o por la URL pública del bucket (`S3_PUBLIC_BASE_URL`).
- **Producción con Docker/VPS**: monta un volumen persistente en `UPLOAD_DIR`, o usa `STORAGE_DRIVER=s3` (recomendado si escalas a varias instancias).

> ⚠️ **Fotografías demo.** Los 38 productos de demostración usan recortes de baja resolución del mockup (`public/demo`). Son solo marcadores de posición: súbe las fotos reales desde *Admin → Productos*. Los productos demo se identifican con el SKU `DEMO-###`, la etiqueta **DEMO** en el panel y un botón **«Eliminar demo»** que los borra (o archiva si ya tuvieran ventas).

## 7. Reglas de negocio (todas validadas en el servidor)

- **Precios**: el cliente solo envía `variantId` y `cantidad`. Precio, oferta, promoción, descuento, envío y total se recalculan en el servidor en céntimos enteros (`lib/pricing-core.ts`).
- **Stock**: se descuenta al crear el pedido (reserva) con un `UPDATE` condicional atómico (`stock + delta >= 0`), imposible vender stock inexistente aun con compras simultáneas. Cada cambio queda en `InventoryMovement`.
- **Idempotencia**: cada checkout lleva una clave única; reintentos o doble clic no duplican el pedido.
- **Cancelación**: devuelve el stock y libera el cupón **una sola vez** (bandera `stockRestored` con claim atómico).
- **Cupones**: estado, vigencia, compra mínima, categorías aplicables y límite de usos (consumo atómico) validados al confirmar.
- **Promociones**: descuentos automáticos por categoría/tienda con fechas; se aplica el menor precio entre oferta, promoción y variante.
- **Pagos**: Yape/Plin/transferencia nunca se aprueban solos. `PENDIENTE → EN_REVISION` (al subir comprobante) `→ APROBADO | RECHAZADO` (solo admin; el rechazo exige motivo y el cliente puede reenviar). Un pedido no puede avanzar a *Preparando* sin pago aprobado (salvo contra entrega).
- **Estado de pedido**: `PENDIENTE → PAGO_EN_REVISION → PAGO_CONFIRMADO → PREPARANDO → LISTO_PARA_ENTREGA → EN_CAMINO → ENTREGADO` (+ `CANCELADO`), con historial (fecha, observación y responsable).
- **«Venta»** (reportes/dashboard) = pedido con pago confirmado o posterior, sin cancelar.

## 8. Seguridad

Contraseñas con bcrypt · sesiones en BD con token hasheado (HMAC) y cookie `httpOnly; SameSite=Lax; Secure` · control de rol **en servidor** (`requireAdmin`/`assertAdmin` en layouts, páginas, acciones y handlers; el middleware es solo una primera barrera) · Zod en toda entrada · Prisma parametrizado (sin SQL concatenado) · React escapa XSS y el JSON-LD se sanea · CSRF: Server Actions verifican Origin; los handlers que mutan exigen `Origin == Host` · rate limiting persistente en PostgreSQL (login, registro, recuperación, checkout, contacto, subidas…) · mensajes de login/recuperación que no revelan si una cuenta existe · open-redirect bloqueado · cabeceras de seguridad (`X-Frame-Options`, `nosniff`, CSP base, HSTS en producción) · validación de archivos por firma · registro de auditoría (`AuditLog`) de operaciones administrativas · invitados acceden a sus pedidos mediante cookie firmada o código + correo.

## 9. SEO y rendimiento

Metadata dinámica y Open Graph por página · URLs amigables (`/productos/[slug]`, `/categorias/[slug]`) · `sitemap.xml` y `robots.txt` dinámicos · JSON-LD `Product` · `canonical` · páginas privadas con `noindex` · imágenes AVIF/WebP + lazy loading + `sizes` · fuentes con `next/font` · mobile-first.

## 10. Pruebas

```bash
npm run test:unit          # precios, cupones, envío, validaciones, transiciones
npm run test:integration   # concurrencia de stock, idempotencia, cupones, cancelaciones, pagos, sesiones, permisos
```

Las pruebas de integración corren contra una **base de datos separada** (`neondb_test`, variable `TEST_DATABASE_URL_UNPOOLED`) y **abortan** si el nombre de la base no termina en `_test` (el `TRUNCATE` previo a cada prueba jamás puede tocar los datos reales). Crear una vez:

```sql
CREATE DATABASE neondb_test;           -- ejecutar con la conexión directa de Neon
```
```bash
# apuntar DATABASE_URL(_UNPOOLED) a .../neondb_test y migrar
DATABASE_URL=<url-test> DATABASE_URL_UNPOOLED=<url-test> npx prisma migrate deploy
```

Se usa la conexión directa (sin pooler) para que el SQL crudo y las transacciones se comporten igual que en producción.

Cubren: stock inexistente nunca se vende (8 compras simultáneas con stock 3 → 3 pedidos), totales calculados en servidor, idempotencia, límite de cupón bajo concurrencia, cancelaciones sin duplicar stock, pago rechazado nunca aprobado, comprobantes con formato falso, cliente sin acceso a administración, cookie de invitado manipulada, rate limiting, recuperación de acceso de un solo uso.

## 11. Despliegue

### Opción A · Docker (VPS)

```bash
cp .env.example .env && nano .env                      # NEXT_PUBLIC_SITE_URL=https://tu-dominio.com …
docker compose build
docker compose --profile tools run --rm tools           # 1.ª vez: migraciones + seed
docker compose up -d app                                # app en :3000, volumen lucia_storage para archivos
```

La imagen (`Dockerfile`, multi-etapa, usuario no-root, `HEALTHCHECK` en `/api/health`) usa el build **standalone** de Next.js. Las variables se inyectan en ejecución; el build no necesita acceso a la BD.

### Opción B · Node directo (VPS/PM2)

```bash
npm ci && npx prisma migrate deploy && npm run build
npm start        # o: pm2 start npm --name lucia -- start
```

### Opción C · Vercel

Vercel no permite escribir en disco, por eso `STORAGE_DRIVER=local` **no funciona** allí (las subidas de imágenes fallarían). Usa **Vercel Blob** (lo más simple) o S3:

1. En Vercel → tu proyecto → **Storage** → *Create* → **Blob** → conéctalo al proyecto. Vercel agrega `BLOB_READ_WRITE_TOKEN` automáticamente (no hace falta tocar `STORAGE_DRIVER`: con ese token y `VERCEL=1` se usa Blob solo).
2. Define el resto de variables (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`, …) y **redespliega** (las variables nuevas solo aplican a nuevos despliegues).
3. Ejecuta las migraciones/seed una vez desde tu equipo apuntando a Neon (`npx prisma migrate deploy` y `npm run db:seed`).
4. Límite de Vercel: ~4,5 MB por petición. El panel reduce automáticamente las fotos grandes antes de subirlas; los comprobantes admiten hasta 4 MB.
5. Los comprobantes de pago se guardan con nombre aleatorio y **nunca se publica su URL**: solo se leen por `/api/proofs/[id]` con autorización. Si necesitas almacenamiento verdaderamente privado, usa S3/R2 con bucket privado.

Si la subida falla, *Admin → Configuración* muestra el estado del almacenamiento y el mensaje de error indica qué falta.

### Opción D · Otras plataformas compatibles con Next.js
Define las variables de entorno, usa `STORAGE_DRIVER=s3` (los sistemas de archivos suelen ser efímeros) y ejecuta `prisma migrate deploy` en el paso de release.

### Dominio y HTTPS
1. Apunta el DNS (`A`/`AAAA`) del dominio al servidor.
2. Pon un proxy inverso con TLS delante de `:3000`. Ejemplo **Caddy** (`Caddyfile`):
   ```
   tu-dominio.com {
     encode gzip zstd
     reverse_proxy localhost:3000
   }
   ```
   (Nginx + Certbot también funciona; reenvía `Host` y `X-Forwarded-For`.)
3. `NEXT_PUBLIC_SITE_URL=https://tu-dominio.com` (activa cookies `Secure`, canonical y sitemap).
4. Envía el `https://tu-dominio.com/sitemap.xml` a Google Search Console.

### Respaldos
- **Base de datos**: Neon incluye *point-in-time restore* (ventana según plan). Además, haz volcados periódicos:
  `pg_dump "$DATABASE_URL_UNPOOLED" --format=custom --file=lucia-$(date +%F).dump` (cron diario; guarda fuera del servidor).
  Restaurar: `pg_restore --clean --no-owner -d "<url>" archivo.dump`.
- **Archivos** (imágenes y comprobantes): con `local`, respalda el volumen (`docker run --rm -v lucia_storage:/data -v $PWD:/backup alpine tar czf /backup/storage-$(date +%F).tgz /data`); con `s3`, activa *versioning* y replicación del bucket.
- Guarda `.env` (secretos) en un gestor de contraseñas; **rota** `DATABASE_URL`/`AUTH_SECRET` si se exponen.

## 12. Estructura

```
app/
  (store)/        tienda pública: inicio, catálogo, categorías, producto, carrito, checkout,
                  pedidos, favoritos, mi-cuenta, nosotros, contacto, políticas
  (auth)/         login, registro, recuperar, restablecer
  admin/          dashboard, productos, categorías, inventario, pedidos, pagos, clientes,
                  promociones, cupones, banners, reportes, mensajes, notificaciones, configuración
  actions/        server actions de la tienda (auth, carrito, checkout, cuenta)
  api/            search, uploads, comprobantes, export de reportes, health
components/       ui · layout · products · cart · checkout · orders · account · auth · admin
lib/
  auth/           sesiones, tokens, guards, acceso a pedidos
  services/       catálogo, precios, carrito, pedidos, pagos, inventario, reportes, notificaciones…
  validations/    esquemas Zod
  storage/        local / S3
prisma/           schema.prisma · migrations · seed.ts
tests/            unit · integration
docker/           entrypoint.sh
```

## 13. Decisiones técnicas documentadas

- **Autenticación propia en vez de Auth.js**: sesiones en BD con revocación inmediata (cambio de contraseña, desactivación de cuenta), sin depender de una versión beta de Auth.js con Next 15; mismo nivel de seguridad y control total de roles.
- **Stock reservado al crear el pedido** (no al pagar): evita sobreventa; la cancelación lo devuelve una sola vez.
- **Provincia/Distrito como texto libre**: el catálogo completo de ubigeo no se incluye; el **departamento** sí es lista cerrada y define la zona/costo de envío (administrable).
- **Filtros de catálogo en memoria sobre filas livianas**: permite filtrar/ordenar por *precio efectivo* (oferta + promociones) de forma consistente; adecuado para catálogos de cientos/miles de productos.
- **Pedidos de invitado permitidos** (el catálogo es público y el cliente solo debe dar sus datos); se consulta con cookie firmada o código + correo.
- **WhatsApp**: integración real con Cloud API solo cuando hay credenciales; la API de Meta exige plantillas aprobadas fuera de la ventana de 24 h, por eso se ofrece además el envío manual por `wa.me`.
- **Reportes**: «venta» = pago confirmado o posterior; las fechas se agrupan en hora de Lima.

## 14. Primeros pasos tras instalar

1. Inicia sesión como administrador → *Configuración*: revisa nombre, contacto, **activa Yape/Plin/transferencia con tus datos reales** (número, titular, QR), zonas y costos de envío, políticas y textos (los incluidos son de ejemplo).
2. Sube tu **logotipo** si deseas reemplazar el incluido y las **fotos reales** de tus productos; elimina los productos DEMO.
3. Edita los **banners** del inicio.
4. Cambia la contraseña inicial y, en producción, rota cualquier credencial compartida durante el desarrollo.
