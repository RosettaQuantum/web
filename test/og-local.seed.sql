-- Semilla local SOLO para el camino de RESPALDO de /og/<id>.png: la tabla `posts`.
--
-- LA PARTE DE li_cards SE BORRO DE AQUI, Y POR QUE IMPORTA
-- -------------------------------------------------------
-- Este archivo llego a declarar un `li_cards (post_id, title, tldr, pillar, date, lang)`
-- INVENTADO, porque la lectura de la base de produccion estaba fuera de permiso y se
-- resolvio adivinando. El esquema real tiene tres columnas y el contenido vive dentro de
-- `spec_json`: ninguna de las que decia esta fixture existe. Como el codigo emparejaba
-- nombres candidatos contra lo que encontrara, **la fixture inventada hacia pasar al
-- codigo inventado** y la cabecera devolvia sus propios nombres como si fueran un dato
-- de produccion. Una fixture que se escribe para que pase el codigo no prueba nada.
--
-- Las filas de li_cards para probar son REALES y viven en `test/li_cards.real.seed.sql`,
-- copiadas de produccion. El esquema declarado esta en `db/li-cards.schema.sql`.
--
-- Uso (las dos, en este orden):
--   npx wrangler d1 execute rosettaq-ledger --local --file test/og-local.seed.sql
--   npx wrangler d1 execute rosettaq-ledger --local --file test/li_cards.real.seed.sql

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY, slug_base TEXT NOT NULL, lang TEXT NOT NULL,
  title TEXT NOT NULL, tldr TEXT NOT NULL, date TEXT NOT NULL, pillar TEXT NOT NULL,
  sources_json TEXT NOT NULL DEFAULT '[]', body_html TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);

DELETE FROM posts WHERE id IN ('advantaged-solve-en','advantaged-solve-es');

-- El titular y el resumen NO son texto nuevo: son los de la nota /blog/advantaged-solve-en/
-- VIVA en produccion, leidos de su HTML el 26-oct-2026 (titulo, Pilar B y fecha incluidos).
-- Su tldr tiene 400 caracteres a proposito: ejerce la regla de que un tldr que no entra
-- entero se OMITE en vez de recortar texto aprobado.
--
-- La fila en espanol lleva tildes y signo de apertura tambien a proposito: es el unico
-- modo de ejercer que las TTF embebidas traen esos glifos. Una fixture sin tildes habria
-- pasado verde con una fuente que no sabe pintarlas.
INSERT INTO posts (id, slug_base, lang, title, tldr, date, pillar, sources_json, body_html, published, created_at)
VALUES
 ('advantaged-solve-en','advantaged-solve','en',
  'What is an "advantaged solve" and why does it matter?',
  'An advantaged solve is one problem instance where a quantum recipe measurably beat the strongest classical baseline its user could field — same instance, same budget, measured, dated, and re-runnable. It is a unit of evidence, not a unit of billing, and it is equally honest about counting zero. As of August 2026, zero advantaged solves are verified in Rosetta Q''s ledger — including its own runs.',
  '2026-08-26','B','[]','<p>fixture</p>',1,'2026-08-26T00:00:00Z'),
 ('advantaged-solve-es','advantaged-solve','es',
  '¿Qué es una "solución con ventaja" y por qué importa?',
  'Una fila en español con tildes y signo de apertura: es el único modo de ejercer que la TTF embebida trae esos glifos.',
  '2026-08-26','B','[]','<p>fixture</p>',1,'2026-08-26T00:00:00Z');
