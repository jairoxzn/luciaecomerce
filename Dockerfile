# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# LUCIA JEANS — imagen de producción (Next.js standalone + Prisma)
#   docker build -t lucia-jeans .
#   docker run -p 3000:3000 --env-file .env -v lucia_storage:/app/storage lucia-jeans
# Las variables de entorno se pasan en tiempo de EJECUCIÓN (no se incluyen en la imagen).
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=22

# ---------- Base ----------
FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------- Dependencias (con cache de capas) ----------
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
# `postinstall` ejecuta `prisma generate` (no necesita conexión a la BD)
RUN npm ci

# ---------- Build ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# El build NO consulta la base de datos: las páginas con parámetros (producto, políticas) se generan bajo demanda (ISR)
# y el resto son dinámicas. sharp y next/image se incluyen en standalone.
RUN npm run build

# ---------- Herramientas: migraciones y seed (docker compose run --rm tools) ----------
FROM builder AS tools
ENV NODE_ENV=development
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed"]

# ---------- Runtime ----------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/app/storage

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs --create-home nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Prisma CLI + migraciones (permite `RUN_MIGRATIONS=true` al arrancar)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=nextjs:nodejs docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh \
 && mkdir -p /app/storage && chown nextjs:nodejs /app/storage

# Imágenes de productos y comprobantes (almacenamiento local): montar un volumen persistente
VOLUME ["/app/storage"]
USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker/entrypoint.sh"]
CMD ["node", "server.js"]
