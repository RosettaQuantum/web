-- Lado de LECTURA del motor: estructuras y propagaciones.
--
-- QUE ES ESTO Y QUE NO
-- --------------------
-- El computo vive en `quantum-run` (Python: numpy/scipy/prody) y no puede correr en
-- un Worker. Lo que entra aca es lo que ese motor PUBLICA como contrato, copiado
-- desde `contracts/v1/` del commit 1b2bb9b. Esta base no calcula nada: sirve.
--
-- POR QUE LA MATRIZ NO ESTA ACA
-- -----------------------------
-- La de miosina son 954x954 float32 = 3.120 KB. D1 ya tumbo un INSERT de 102 KB con
-- SQLITE_TOOBIG. Se guardan los METADATOS y la referencia: URL en el repo publico
-- `evidence`, `contenido_sha256` y `bytes`, para que quien la baje pueda comprobarla.
--
-- Y OJO CON ESE HASH: es del CONTENIDO (bytes de cada arreglo en orden de clave), no
-- del archivo .npz. Un .npz es un zip y su compresion cambia con la version de numpy
-- — el CI del motor lo atrapo declarando un hash que otro entorno no reproducia. El
-- campo se llama `contenido_sha256` a proposito, para que nadie lo confunda.
--
-- LO QUE ESTAS TABLAS TIENEN QUE DECIR SIEMPRE
-- --------------------------------------------
-- `validado_experimentalmente` = 0. Son predicciones de una caminata cuantica.
-- `n_sitios_predichos` es el numero REAL — KRAS 5, ABL1 4, miosina 3, c-Myc 1.
-- Nunca rellenado a cinco: ese fue el defecto del "Top-5" de la corrida de julio.

DROP TABLE IF EXISTS propagations;
DROP TABLE IF EXISTS structures;

CREATE TABLE structures (
  pdb_id            TEXT PRIMARY KEY,
  target            TEXT NOT NULL,
  chain             TEXT,
  n_residuos        INTEGER NOT NULL,
  n_aristas         INTEGER NOT NULL,
  n_distales        INTEGER NOT NULL,
  n_fuente          INTEGER NOT NULL,
  red_json          TEXT NOT NULL,   -- tipo, corte, peso, conexa_desde_la_fuente
  fuente_json       TEXT NOT NULL,   -- definicion, metodo, residuos
  distal_json       TEXT NOT NULL,
  procedencia_json  TEXT NOT NULL,   -- sha256 y URL del PDB de origen, ciego, notas
  aviso             TEXT NOT NULL,
  contrato_sha256   TEXT NOT NULL,   -- sello del archivo de contrato del que salio
  orden             INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE propagations (
  run_id             TEXT NOT NULL,
  target             TEXT NOT NULL,
  pdb_id             TEXT NOT NULL,
  chain              TEXT,
  validado           INTEGER NOT NULL DEFAULT 0,
  metrico_json       TEXT NOT NULL,   -- nombre, definicion, parametros_libres, pre_registrado_en
  matriz_json        TEXT NOT NULL,   -- forma, dtype, url, contenido_sha256, bytes, como_verificar
  n_sitios_predichos INTEGER NOT NULL,
  sitios_json        TEXT NOT NULL,
  aviso              TEXT NOT NULL,
  contrato_sha256    TEXT NOT NULL,
  orden              INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (run_id, target)
);
CREATE INDEX idx_prop_run ON propagations (run_id, orden);
