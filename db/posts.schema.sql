-- Tabla de posts de la Biblioteca servidos por el Worker desde D1 (sin rebuild).
CREATE TABLE IF NOT EXISTS posts (
  id           TEXT PRIMARY KEY,            -- slug de archivo, p.ej. what-does-it-cost-...-en
  slug_base    TEXT NOT NULL,               -- sin sufijo de idioma
  lang         TEXT NOT NULL CHECK (lang IN ('en','es')),
  title        TEXT NOT NULL,
  tldr         TEXT NOT NULL,
  date         TEXT NOT NULL,               -- YYYY-MM-DD
  pillar       TEXT NOT NULL CHECK (pillar IN ('A','B','C','D','E','F')),
  sources_json TEXT NOT NULL DEFAULT '[]',  -- [{label,url}]
  body_html    TEXT NOT NULL,               -- markdown del cuerpo ya renderizado a HTML
  published    INTEGER NOT NULL DEFAULT 0,  -- 1 = en vivo
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_lang_pub_date ON posts (lang, published, date);
