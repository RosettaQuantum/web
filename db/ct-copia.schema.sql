-- Copia GLOBAL de la última respuesta buena de crt.sh por dominio (12-nov-2026).
-- caches.default es por centro de datos: una copia guardada en Santiago no existe en Miami.
-- Medido: crt.sh cayó, la copia del borde no estaba en ese colo, y la medición bajó a Cert Spotter
-- (120 certificados contra 1.868): un banco pasó de QEX 56 a 58 sin que nada cambiara.
CREATE TABLE IF NOT EXISTS ct_copia (
  dominio        TEXT PRIMARY KEY,
  consultado_utc TEXT NOT NULL,
  ms             INTEGER,
  gz             BLOB NOT NULL      -- el texto crudo de crt.sh, gzip: la huella se recalcula sobre el texto
);
