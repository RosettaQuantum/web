-- Saludos TLS en 443 desde el VPS (13-nov-2026): la cola entre /api/sondas y la sonda del VPS
-- (vps/sonda-correo/sonda_tls.py), para lo que el Worker no puede saludar (dominios detrás de
-- Cloudflare). Mismo patrón que sondas_correo. La escribe y la lee lib/sonda-tls-vps.mjs, que
-- también la crea perezosamente; este archivo la declara (check-esquema-deriva).
--
-- entorno: el preview (modo de prueba) escribe 'preview-prueba' y el VPS de producción sólo toma
-- 'produccion'. Retención: las filas de más de un día se borran solas. Guarda el dominio, los nombres
-- pedidos y los saludos (datos públicos de sus servidores); nada del visitante.
--
-- Aplicar (misma base para producción y preview):
--   npx wrangler d1 execute rosettaq-ledger --remote --file db/sondas-tls.schema.sql
CREATE TABLE IF NOT EXISTS sondas_tls (
  id TEXT PRIMARY KEY,
  entorno TEXT NOT NULL CHECK (entorno IN ('produccion','preview-prueba')),
  dominio TEXT NOT NULL,
  pedido TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('pendiente','tomado','hecho')),
  creado_ms INTEGER NOT NULL,
  tomado_ms INTEGER,
  hecho_ms INTEGER,
  resultado TEXT
);
-- El latido: cuándo preguntó la sonda por última vez. Sin latido reciente, /api/sondas no espera al VPS.
CREATE TABLE IF NOT EXISTS sondas_tls_latido (
  entorno TEXT PRIMARY KEY,
  ultimo_ms INTEGER NOT NULL
);
