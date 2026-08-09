-- Archivador de algoritmos y fuentes cuanticas.
--
-- POR QUE EXISTE
-- --------------
-- /clases/ era una pagina estatica escrita a mano: los datos vivian en el HTML, no
-- se podian consultar por maquina y nadie podia comprobar de donde salia cada fila.
-- Estas dos tablas mueven el catalogo a la base, con la cita de cada dato pegada al
-- dato, para que la pagina y la API lean de la MISMA fuente.
--
-- REGLA DE HONESTIDAD DE ESTAS TABLAS
-- -----------------------------------
-- 1. Ninguna fila afirma nada sin decir de donde lo saco: `fuente_url` es obligatoria
--    y el generador falla cerrado si falta.
-- 2. `speedup_declarado` es lo que DECLARA la fuente canonica, no lo que nosotros
--    medimos. Son cosas distintas y la tabla las mantiene separadas a proposito:
--    catalogar no es implementar, y declarar no es medir.
-- 3. Lo que Rosetta si midio vive en `quantum_algorithm_ledger`, y es una tabla
--    aparte y casi vacia porque esa es la verdad: 60 algoritmos catalogados,
--    un punado con evidencia sellada nuestra.
-- 4. `http_status` de las fuentes es MEDIDO al sembrar, no supuesto. Un enlace que
--    prometemos y no ejercimos es la trampa que ya nos costo caro (/api-docs 404).

DROP TABLE IF EXISTS quantum_algorithm_ledger;
DROP TABLE IF EXISTS quantum_algorithms;
DROP TABLE IF EXISTS quantum_sources;

-- Fuentes del campo: quien fabrica QPUs, quien publica, con que se programa.
CREATE TABLE quantum_sources (
  id              TEXT PRIMARY KEY,   -- slug estable
  tipo            TEXT NOT NULL,      -- qpu | empresa | libreria | venue | blog | catalogo | estandar
  nombre          TEXT NOT NULL,
  url             TEXT NOT NULL,
  que_es          TEXT NOT NULL,      -- ES neutro, una linea
  por_que_importa TEXT NOT NULL,      -- ES neutro, una linea
  pais            TEXT,
  http_status     INTEGER,            -- MEDIDO al generar la semilla, no supuesto
  verificado_at   TEXT,               -- fecha de esa medicion (YYYY-MM-DD)
  nota_enlace     TEXT,               -- por que un codigo raro no significa enlace roto

  orden           INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_qsources_tipo ON quantum_sources (tipo, orden);

-- Algoritmos catalogados. Un algoritmo = una entrada de la fuente canonica.
CREATE TABLE quantum_algorithms (
  id                TEXT PRIMARY KEY, -- slug estable
  nombre            TEXT NOT NULL,
  categoria         TEXT NOT NULL,
  categoria_id      TEXT NOT NULL,
  problema_es       TEXT,             -- que ataca, en ES. NULL = todavia no redactado (se declara)
  speedup_declarado TEXT NOT NULL,    -- literal de la fuente; NO es una medicion nuestra
  fuente_nombre     TEXT NOT NULL,
  fuente_url        TEXT NOT NULL,    -- obligatoria: sin cita la fila no entra
  ancla             TEXT,             -- ancla propia en la fuente, si la entrada la trae
  refs_json         TEXT NOT NULL DEFAULT '[]',  -- [{n,cita,url}] papers primarios
  impl_json         TEXT NOT NULL DEFAULT '[]',  -- [{nombre,url}] implementaciones publicas
  remisiones_json   TEXT NOT NULL DEFAULT '[]',  -- anclas a otras entradas del propio catalogo
  n_refs            INTEGER NOT NULL DEFAULT 0,
  orden             INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_qalgos_cat ON quantum_algorithms (categoria_id, orden);

-- El cruce con NUESTRO ledger. Vacia para casi todo, y esa es la afirmacion.
CREATE TABLE quantum_algorithm_ledger (
  algorithm_id TEXT NOT NULL,
  recipe_id    TEXT NOT NULL,
  nota         TEXT,
  PRIMARY KEY (algorithm_id, recipe_id)
);

-- Procedencia de la semilla: de que instantanea salio, con su sha256, para que
-- cualquiera pueda bajar la misma fuente y reconstruir estas filas.
CREATE TABLE IF NOT EXISTS quantum_catalog_meta (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
