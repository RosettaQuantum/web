-- Visitas agregadas por dia, ruta, clase de agente y sitio de origen (encargo del 8-nov-2026,
-- motor de contenido). Las escribe worker.js via lib/hits.mjs; las lee el motor de contenido
-- (resumen de los lunes y reporte mensual), que tambien poda las filas viejas.
-- Privacidad: sin IP, sin user-agent crudo, sin query string. Solo la CLASE del agente,
-- el HOST del referrer y la ruta.
CREATE TABLE IF NOT EXISTS hits (
  day TEXT NOT NULL,                       -- YYYY-MM-DD en UTC
  path TEXT NOT NULL,                      -- ruta sin query string
  ua_class TEXT NOT NULL,                  -- ai:<bot> | search:<bot> | bot:other | browser
  referrer_host TEXT NOT NULL DEFAULT '',
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path, ua_class, referrer_host)
);
