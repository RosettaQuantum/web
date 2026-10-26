-- Tarjetas sociales que escribe el motor de contenido. UNA fila por slug_base.
--
-- POR QUE ESTE ARCHIVO EXISTE. La tabla llevaba meses viva en D1 **sin estar declarada en
-- ninguna parte**: aparece en el catastro del 31-ago entre las tablas de produccion y no
-- tenia esquema en el repositorio. Es exactamente la deriva que `check-esquema-deriva`
-- existe para cazar —si la base se pierde, no hay con que reconstruirla— y ademas fue la
-- causa directa de que la primera version de /og/<id>.png se escribiera contra una forma
-- inventada: sin declaracion, no habia contra que comprobar.
--
-- Transcrito de `sqlite_master` en produccion el 26-oct-2026. 64 filas vivas.
--
-- EL CONTENIDO VA DENTRO DE spec_json Y HAY DOS FORMAS CONVIVIENDO. No se normalizan aqui
-- a proposito: quien las escribe es el motor de contenido, y este archivo DECLARA lo que
-- hay, no lo que nos gustaria. lib/og.mjs sirve las dos y cae a `posts` si aparece una
-- tercera.
--
--   Forma A (nota larga):  kicker, date, title_html, bignum, vlabel_html, rtitle,
--                          panel[{n,text,gold}], footnote
--                          `title_html` y `vlabel_html` traen marcado propio del motor:
--                          <accent> y <b>. Se interpretan, no se imprimen.
--   Forma B (marcador):    pillar, format, headline_en, headline_es, number, subhead_en,
--                          subhead_es, limit_en, limit_es, image, content_hash
--                          Bilingue: el sufijo -es del id de la nota elige la variante.
--
-- Cuatro filas reales, para pruebas locales, en `test/li_cards.real.seed.sql`.

CREATE TABLE IF NOT EXISTS li_cards (
  slug_base  TEXT PRIMARY KEY,   -- el slug SIN sufijo de idioma: 'advantaged-solve'
  spec_json  TEXT NOT NULL,      -- el spec de la tarjeta; dos formas, ver arriba
  created_at TEXT NOT NULL
);
