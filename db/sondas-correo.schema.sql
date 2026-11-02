-- Cola de la sonda de correo (2-nov-2026). Ver lib/correo-envivo.mjs.
--
-- NO se aplica a mano: el Worker la crea sola en el primer uso (autocreación perezosa, el
-- mismo patrón de qready-lead.mjs). Este archivo documenta el esquema real; la sentencia
-- que lo instala es CREAR_TABLA en lib/correo-envivo.mjs y debe decir lo mismo.
-- Retención: filas de más de un día se borran en cada pedido nuevo.
CREATE TABLE IF NOT EXISTS sondas_correo (
  id TEXT PRIMARY KEY,
  dominio TEXT NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('pendiente','tomado','hecho')),
  creado_ms INTEGER NOT NULL,
  tomado_ms INTEGER,
  hecho_ms INTEGER,
  resultado TEXT
);
