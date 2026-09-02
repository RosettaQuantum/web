-- Commit 5 del spec de migracion v5.2. Idempotente: se puede correr dos veces.
--
-- monitor_leads: la captura de correo del Monitor. El binding MAILER ya existe y esta
-- desplegado, asi que no entra ningun tercero ni ningun secreto nuevo.
CREATE TABLE IF NOT EXISTS monitor_leads (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  email   TEXT NOT NULL,
  ts      TEXT NOT NULL,
  ua      TEXT,
  origen  TEXT
);
CREATE INDEX IF NOT EXISTS idx_monitor_leads_ts ON monitor_leads(ts);

-- market_questions: lo que el mercado nos pregunta.
--
-- POR QUE EXISTE: el archivo mide con rigor notarial todo lo que NOSOTROS medimos y
-- guarda CERO de lo que nos preguntaron. Cinco sumisiones a jurados corporativos y no
-- hay una sola pregunta registrada. Para una casa cuyo producto es el juicio, no saber
-- que preguntas se repiten es el punto ciego mas caro que tiene: el orden de los
-- productos, el precio y el argumento de venta se deciden por intuicion, que es
-- justamente lo que aca no se acepta en ninguna otra parte.
--
-- REGLA DE PROCESO (no es codigo, y sin ella la tabla queda vacia para siempre):
-- toda pregunta de jurado, contraparte o prospecto se registra EL MISMO DIA, antes de
-- contestarla.
CREATE TABLE IF NOT EXISTS market_questions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha          TEXT NOT NULL,
  origen         TEXT NOT NULL,
  pregunta       TEXT NOT NULL,
  contexto       TEXT,
  respuesta_dada TEXT
);
CREATE INDEX IF NOT EXISTS idx_market_questions_fecha ON market_questions(fecha);
