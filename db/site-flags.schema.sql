-- Interruptores del sitio que se cambian SIN deploy (17-nov-2026). Los lee el Worker en cada
-- petición. Falla cerrado: sin tabla, sin fila, o con un valor distinto de '1', el
-- interruptor está APAGADO.
--
--   promo_guia  el pop-up que anuncia la guía PQC (lib/guia.mjs → flagPromo). Aunque esté en
--               '1', no aparece mientras la guía no tenga published=1.
--
-- Encender:  UPDATE site_flags SET v='1', updated_at=datetime('now') WHERE k='promo_guia';
-- Apagar:    UPDATE site_flags SET v='0', updated_at=datetime('now') WHERE k='promo_guia';
CREATE TABLE IF NOT EXISTS site_flags (k TEXT PRIMARY KEY, v TEXT NOT NULL, updated_at TEXT NOT NULL);
INSERT OR IGNORE INTO site_flags (k, v, updated_at) VALUES ('promo_guia', '0', '2026-11-17T00:00:00Z');
