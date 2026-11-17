-- Páginas completas servidas desde D1 por lib/guia.mjs (hoy: la guía PQC v1.1, es + en).
-- Transcrito de `sqlite_master` en producción el 17-nov-2026: la tabla la creó Cowork y vivía
-- sin declarar. `html` es un documento COMPLETO: el Worker no lo envuelve en ningún layout.
-- `published` lo cambia sólo Nicholas: con 0 la ruta da 404 y la guía no entra al sitemap,
-- ni a /llms.txt, ni el pop-up la anuncia.
CREATE TABLE IF NOT EXISTS pages (id TEXT PRIMARY KEY, slug_base TEXT NOT NULL, lang TEXT NOT NULL CHECK (lang IN ('es','en')), path TEXT NOT NULL UNIQUE, alt_path TEXT, title TEXT NOT NULL, description TEXT NOT NULL, html TEXT NOT NULL, pdf_path TEXT, version TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
