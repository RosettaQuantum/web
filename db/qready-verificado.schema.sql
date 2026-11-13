-- Q-Ready Verified (13-nov-2026): la nota A+…F, las mediciones que la sostienen y los dominios
-- que su dueño verificó por DNS. Lo escribe lib/qready-verificado.mjs (y lib/captacion.mjs la
-- medición que el visitante consiente guardar); toda escritura se confirma con RETURNING.
--
-- REGLA QUE ESTAS TABLAS NO ROMPEN: una nota con nombre se publica SÓLO si el dueño verificó el
-- dominio (verificado_en no nulo) Y eligió publicarla (publico = 1). Sin las dos, /verificado da 404
-- y el sello sale neutro. Una medición guardada no publica nada por sí sola.
--
-- `entorno`: la base es la MISMA para producción y preview. El preview tiene un modo de prueba del
-- DNS (QREADY_PRUEBA_DNS, sólo en env.preview) que escribe con entorno = 'preview-prueba'.
-- Producción sólo lee entorno = 'produccion': un dominio «verificado» en modo de prueba nunca se
-- publica en rosettaquantum.com.
--
-- Aplicar (misma base para producción y preview):
--   npx wrangler d1 execute rosettaq-ledger --remote --file db/qready-verificado.schema.sql

-- Una fila por medición guardada.
--   origen 'pagina'   = la midió el navegador del visitante y él consintió guardarla (mismo
--                       consentimiento del informe). La foto llega del navegador: se guarda, pero
--                       NUNCA se muestra en /verificado ni alimenta el sello.
--   origen 'servidor' = la midió el Worker de Rosetta (alta o cron diario), con el mismo camino que
--                       la medición para agentes (lib/medicion-agentes.mjs → tomarFoto). Sólo éstas
--                       se publican.
-- nota NULL = sin nota (el borde no se pudo medir): nunca se escribe una letra inventada.
CREATE TABLE IF NOT EXISTS qready_mediciones (
  id          TEXT PRIMARY KEY,
  dominio     TEXT NOT NULL,
  fecha       TEXT NOT NULL,                                   -- medido_utc de la foto
  qex         INTEGER,
  nota        TEXT CHECK (nota IS NULL OR nota IN ('A+','A','B','C','D','F')),
  sha256      TEXT NOT NULL CHECK (length(sha256) = 64),
  foto_json   TEXT NOT NULL,
  origen      TEXT NOT NULL CHECK (origen IN ('pagina','servidor')),
  entorno     TEXT NOT NULL DEFAULT 'produccion' CHECK (entorno IN ('produccion','preview-prueba')),
  creado_utc  TEXT NOT NULL,
  UNIQUE (dominio, sha256)
);
CREATE INDEX IF NOT EXISTS qready_mediciones_dominio_fecha ON qready_mediciones (dominio, fecha);

-- Un pedido de verificación por fila. La llave es el token (aleatorio, 32 bytes en hex), no el
-- dominio: así nadie puede pisar el pedido de otro ni cambiar el contacto de un dominio ajeno.
-- El dueño publica TXT `_qready.<dominio>` = `qready-verificacion=<token>`. Cuando el Worker lo ve
-- por DNS sobre HTTPS, verificado_en toma la hora; si otro pedido del mismo dominio estaba
-- verificado, deja de estarlo (el TXT nuevo prueba el control de hoy).
-- Re-chequeo diario: SÓLO la AUSENCIA confirmada del TXT despublica (verificado_en = NULL). Un error
-- de red o un SERVFAIL se anota en ultimo_chequeo_estado y no cambia nada.
-- sector: lo pide el alta porque el QEX lo necesita (la postura HNDL es del sector).
-- inventario_verificado_en: lo pone una persona de Rosetta tras revisar el inventario interno.
-- Ningún código lo escribe. Sin él no hay A+.
CREATE TABLE IF NOT EXISTS qready_dominios (
  token                     TEXT PRIMARY KEY CHECK (length(token) = 64),
  dominio                   TEXT NOT NULL,
  sector                    TEXT NOT NULL,
  contacto                  TEXT,
  publico                   INTEGER NOT NULL DEFAULT 0 CHECK (publico IN (0, 1)),
  entorno                   TEXT NOT NULL DEFAULT 'produccion' CHECK (entorno IN ('produccion','preview-prueba')),
  creado_utc                TEXT NOT NULL,
  verificado_en             TEXT,
  ultimo_chequeo_utc        TEXT,
  ultimo_chequeo_estado     TEXT CHECK (ultimo_chequeo_estado IS NULL OR ultimo_chequeo_estado IN ('presente','ausente','error')),
  ultimo_chequeo_detalle    TEXT,
  despublicado_utc          TEXT,
  inventario_verificado_en  TEXT,
  txt_prueba                TEXT                                -- SÓLO modo de prueba del preview: el «TXT» simulado
);
CREATE INDEX IF NOT EXISTS qready_dominios_dominio ON qready_dominios (dominio);
-- A lo más UN pedido verificado por dominio y entorno.
CREATE UNIQUE INDEX IF NOT EXISTS qready_dominios_un_verificado ON qready_dominios (dominio, entorno) WHERE verificado_en IS NOT NULL;
