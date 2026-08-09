-- Corridas de challenge servidas desde la base.
--
-- POR QUE
-- -------
-- El entregable de Cleveland era un HTML de 114 KB del que el 89,5% eran datos.
-- Con ese formato, publicar el challenge siguiente es fabricar otro archivo a mano.
-- Con esto es un INSERT: la pagina y la API leen de aca.
--
-- POR QUE UNA FILA POR PROTEINA Y NO UNA POR CORRIDA
-- --------------------------------------------------
-- El primer intento metia los 102 KB en una sola fila y D1 respondio
-- SQLITE_TOOBIG. Partirlo por proteina no es solo un rodeo al limite: deja el dato
-- consultable de a uno (`/v1/challenges/{corrida}/{proteina}`), que es lo que un
-- agente necesita cuando le preguntan por KRAS y no por las cuatro.
--
-- REGLAS DE ESTAS TABLAS
-- ----------------------
-- 1. `sha256` es el sello del JSON tal como salio del entregable original. La
--    pagina lo publica para que un tercero lo recompute. Si el dato cambia y el
--    sello no, el chequeo grita.
-- 2. `validado` es lo que NO tenemos: son predicciones, no hallazgos confirmados
--    en laboratorio. La columna existe para que la respuesta lo diga siempre.
-- 3. `sitios_conocidos` = 0 significa que ahi no hay contra que comparar. Es un
--    dato, no un vacio: c-Myc esta en ese caso y la pagina tiene que decirlo.

DROP TABLE IF EXISTS challenge_proteins;
DROP TABLE IF EXISTS challenge_runs;

CREATE TABLE challenge_runs (
  id           TEXT PRIMARY KEY,   -- p.ej. cleveland-2026-07
  challenge    TEXT NOT NULL,      -- cleveland
  titulo_es    TEXT NOT NULL,
  titulo_en    TEXT NOT NULL,
  recipe_id    TEXT,               -- receta del ledger, si la hay
  prereg       TEXT,               -- pre-registro que congelo la rejilla
  fecha        TEXT NOT NULL,      -- YYYY-MM
  validado     INTEGER NOT NULL DEFAULT 0,  -- 0 = predicho, sin validacion experimental
  publicado    INTEGER NOT NULL DEFAULT 0,
  creado_at    TEXT NOT NULL
);

CREATE TABLE challenge_proteins (
  run_id           TEXT NOT NULL,
  clave            TEXT NOT NULL,   -- KRAS_G12C
  label            TEXT NOT NULL,   -- rotulo en ES
  label_en         TEXT NOT NULL,   -- y en EN. Las dos caras o ninguna: el sembrador aborta
                                    -- si falta una, porque un rotulo en el idioma equivocado
                                    -- no rompe nada y por eso nadie lo ve.
  pdb              TEXT,
  n_residuos       INTEGER NOT NULL,
  n_sitios         INTEGER NOT NULL,  -- cuantos sitios predichos hay DE VERDAD
  sitios_conocidos INTEGER NOT NULL,  -- 0 = sin verdad de referencia publicada
  datos_json       TEXT NOT NULL,
  stats_json       TEXT NOT NULL,
  sha256           TEXT NOT NULL,
  orden            INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (run_id, clave)
);
CREATE INDEX idx_challenge_prot ON challenge_proteins (run_id, orden);
