-- Uso de la API, agregado y publico.
--
-- POR QUE EXISTE
-- --------------
-- Hoy no sabemos si alguien invoco `/v1/*` o el MCP alguna vez. Sin ese numero,
-- decidir cuando construir el gateway de pago es una corazonada.
--
-- Y POR QUE ES PUBLICO
-- --------------------
-- Nadie publica su propio uso. Nosotros si, y si dice cero, dice cero — igual que
-- el contador de victorias cuanticas. Un contador propio que solo se muestra cuando
-- favorece no es una medicion, es publicidad.
--
-- LO QUE ESTA TABLA NO GUARDA, Y NO ES NEGOCIABLE
-- -----------------------------------------------
-- Ninguna IP. Ningun user-agent. Ninguna cabecera de quien llama. Nada que permita
-- reconstruir el comportamiento de una persona. Solo (fecha, ruta, superficie,
-- tool) y un contador. La ruta se guarda en su FORMA —`/v1/algorithms/{id}`, no
-- `/v1/algorithms/qaoa`— por dos razones: la tabla no crece sin techo, y lo que
-- alguien consulto deja de ser reconstruible desde aca.
--
-- UNA FILA POR DIA Y RUTA, no una por peticion. No queremos una bitacora de
-- comportamiento ni una tabla sin techo: `ON CONFLICT DO UPDATE SET n = n + 1`.

DROP TABLE IF EXISTS api_usage;

CREATE TABLE api_usage (
  fecha      TEXT NOT NULL,        -- YYYY-MM-DD, UTC
  superficie TEXT NOT NULL,        -- api | mcp
  ruta       TEXT NOT NULL,        -- la FORMA de la ruta, nunca con el parametro real
  tool       TEXT NOT NULL DEFAULT '',  -- solo para MCP: que tool se invoco
  n          INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (fecha, superficie, ruta, tool)
);
CREATE INDEX idx_usage_fecha ON api_usage (fecha);

-- Desde cuando se mide. Sin esto, un total de 12 no dice nada: puede ser de un dia
-- o de un ano, y publicar el numero sin su ventana seria un total sin denominador.
CREATE TABLE IF NOT EXISTS usage_meta (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
