-- La ficha maestra de las organizaciones (18-nov-2026). PRIVADA: no se publica ni se lista.
-- De qué país (y sector) es una organización, para no deducir el país del TLD: una organización chilena
-- con dominio .com salía «país no determinado» y no se comparaba con su sector.
-- La lee lib/org-ficha.mjs (una fila por dominio pedido; nunca la lista). Orden del país en la ficha:
-- (1) esta tabla, (2) el `pais` que declara quien consulta, (3) el TLD. Si la tabla no existe o falla,
-- la medición cae a (2) y (3) sin romperse.
--
-- La CARGA no vive en este repo (es público y la lista nombra a las organizaciones del estudio): se
-- genera fuera, desde el archivo sellado del estudio, con su sha256 en el comentario.
--
-- Aplicar (misma base para producción y preview):
--   npx wrangler d1 execute rosettaq-ledger --remote --file db/org-ficha.schema.sql
CREATE TABLE IF NOT EXISTS org_ficha (
  dominio     TEXT PRIMARY KEY CHECK (dominio = lower(dominio) AND dominio NOT LIKE 'www.%'),
  pais        TEXT NOT NULL CHECK (length(pais) = 2 AND pais = upper(pais)),
  sector      TEXT,
  fuente      TEXT NOT NULL,
  actualizado TEXT NOT NULL
);
