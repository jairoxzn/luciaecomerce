#!/bin/sh
set -e

# Aplica migraciones pendientes al arrancar (idempotente). Actívalo con RUN_MIGRATIONS=true
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "→ Aplicando migraciones de Prisma…"
  node node_modules/prisma/build/index.js migrate deploy
fi

exec "$@"
