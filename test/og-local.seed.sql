-- SEMILLA DE PRUEBA LOCAL para /og/<id>.png. NO ES UN ESQUEMA DECLARADO.
--
-- POR QUE VIVE EN test/ Y NO EN db/
-- --------------------------------
-- `li_cards` existe en la D1 de produccion (catastro del 31-ago: aparece en la lista de
-- tablas vivas) y **no esta declarada en ningun db/*.schema.sql**. Su forma real NO se
-- pudo leer en la sesion que escribio esto: la consulta a la base de produccion quedo
-- fuera de permiso. Asi que el CREATE de abajo es una forma PLAUSIBLE para ejercer el
-- camino de lectura en local, no la de produccion.
--
-- Ponerlo en db/ seria peor que no tenerlo: `check-esquema-deriva` grita por toda tabla
-- que vive en D1 y nadie declara, y un CREATE inventado la CALLARIA — una tabla sin
-- respaldo pasaria a parecer respaldada. Exactamente el defecto que ese guardia existe
-- para no reabrir.
--
-- Por eso lib/og-ruta.mjs no asume columnas: descubre las de la tabla viva desde
-- sqlite_master y las empareja contra una lista de candidatas. Esta semilla comprueba
-- que ese emparejado funciona cuando los nombres son `post_id/title/tldr/pillar/date`.
--
-- Uso:
--   npx wrangler d1 execute rosettaq-ledger --local --file test/og-local.seed.sql

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY, slug_base TEXT NOT NULL, lang TEXT NOT NULL,
  title TEXT NOT NULL, tldr TEXT NOT NULL, date TEXT NOT NULL, pillar TEXT NOT NULL,
  sources_json TEXT NOT NULL DEFAULT '[]', body_html TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS li_cards (
  post_id TEXT PRIMARY KEY,
  title   TEXT NOT NULL,
  tldr    TEXT,
  pillar  TEXT,
  date    TEXT,
  lang    TEXT
);

DELETE FROM posts    WHERE id IN ('advantaged-solve-en','advantaged-solve-es');
DELETE FROM li_cards WHERE post_id = 'advantaged-solve';

-- El titular y el resumen NO son texto nuevo: son los de /services/sample-report, que ya
-- estan publicados y ya pasaron por Nicholas. Una fixture con una frase inventada seria
-- texto publico sin aprobar entrando por la puerta de atras.
--
-- Y la fila en espanol lleva TILDES y signo de apertura a proposito: es el unico modo
-- de ejercer de verdad que la TTF embebida trae esos glifos. Una fixture sin tildes
-- habria pasado verde con una fuente que no sabe pintarlas — el defecto de 74 de 74
-- notas sin una sola tilde, pasando un guardia de idioma.
INSERT INTO posts (id, slug_base, lang, title, tldr, date, pillar, sources_json, body_html, published, created_at)
VALUES
 ('advantaged-solve-en','advantaged-solve','en',
  'Constrained portfolio compression: does QAOA beat the classical champion?',
  'A public record that cannot be rewritten.',
  '2026-10-12','C','[]','<p>fixture</p>',1,'2026-10-12T00:00:00Z'),
 ('advantaged-solve-es','advantaged-solve','es',
  'Compresión de cartera con restricciones: ¿le gana QAOA al campeón clásico?',
  'Un registro público que no se puede reescribir.',
  '2026-10-12','C','[]','<p>fixture</p>',1,'2026-10-12T00:00:00Z');

INSERT INTO li_cards (post_id, title, tldr, pillar, date, lang)
VALUES ('advantaged-solve',
  'Constrained portfolio compression: does QAOA beat the classical champion?',
  'A public record that cannot be rewritten.',
  'C','2026-10-12','en');
