-- Quién mide por API o MCP (12-nov-2026). Una fila por medición de POST /v1/medicion o de la
-- herramienta MCP medir_exposicion_pqc. La escribe lib/medicion-agentes.mjs con RETURNING; si la
-- escritura falla, la medición responde igual.
--
-- Nunca la IP cruda: ip_hash = SHA-256(sal | ip), con la sal en el secreto MEDICION_SAL_IP. Sin el
-- secreto, ip_hash queda NULL.
-- agente:            el User-Agent HTTP. En MCP también: el servidor es sin estado y el clientInfo
--                    del initialize llega en otra petición que no se guarda.
-- agente_declarado:  lo que el agente dice de sí mismo en el campo opcional `agente`.
-- No se registran los pedidos con dominio o sector inválido ni los rechazados por el límite (429).
--
-- Aplicar (misma base para producción y preview):
--   npx wrangler d1 execute rosettaq-ledger --remote --file db/medicion-agentes.schema.sql
CREATE TABLE IF NOT EXISTS mediciones_agentes (
  id               TEXT PRIMARY KEY,
  medido_utc       TEXT NOT NULL,
  dominio          TEXT NOT NULL,
  sector           TEXT,
  canal            TEXT NOT NULL CHECK (canal IN ('api', 'mcp')),
  agente           TEXT,
  agente_declarado TEXT,
  ip_hash          TEXT CHECK (ip_hash IS NULL OR length(ip_hash) = 64),
  qex              INTEGER,
  ok               INTEGER NOT NULL CHECK (ok IN (0, 1)),
  error            TEXT
);
CREATE INDEX IF NOT EXISTS mediciones_agentes_utc ON mediciones_agentes (medido_utc);
CREATE INDEX IF NOT EXISTS mediciones_agentes_dominio ON mediciones_agentes (dominio);
