-- Las dos capas de medición (27-nov-2026). Ver lib/capas.mjs.
--
-- qready_exclusiones: quien pidió no ser medido. Una fila cuenta sólo con confirmado_utc: el pedido
-- se confirma con un enlace enviado a un correo del propio dominio, para que nadie excluya a un
-- tercero. revocado_utc: el dueño pidió volver a ser medido.
CREATE TABLE IF NOT EXISTS qready_exclusiones (
  token          TEXT PRIMARY KEY CHECK (length(token) = 64),
  dominio        TEXT NOT NULL,
  correo_sha256  TEXT NOT NULL,          -- se guarda la huella del correo, no el correo
  pedido_utc     TEXT NOT NULL,
  confirmado_utc TEXT,
  revocado_utc   TEXT
);
CREATE INDEX IF NOT EXISTS qready_exclusiones_dominio ON qready_exclusiones (dominio);

-- La autorización de la capa 2 vive en el pedido de verificación: la misma fila que prueba que quien
-- autoriza controla el dominio. Se aplican UNA vez (D1 no tiene ADD COLUMN IF NOT EXISTS):
--   ALTER TABLE qready_dominios ADD COLUMN autorizacion_version TEXT;
--   ALTER TABLE qready_dominios ADD COLUMN autorizacion_utc TEXT;
--   ALTER TABLE qready_dominios ADD COLUMN autorizacion_retirada_utc TEXT;
