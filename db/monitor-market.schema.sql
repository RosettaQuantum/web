-- Commit 5 del spec de migracion v5.2. Idempotente: se puede correr dos veces.
--
-- monitor_leads: la captura de correo. El binding MAILER ya existe y esta desplegado,
-- asi que no entra ningun tercero ni ningun secreto nuevo.
--
-- 'lista' NO es lo mismo que 'origen', y por eso son dos columnas.
--   origen = DESDE DONDE se apunto (la ruta). Dato de producto.
--   lista  = A QUE se apunto. Es el ALCANCE DEL CONSENTIMIENTO, y no se deduce del
--            origen: quien deja su correo en el blog acepta un correo semanal, no la
--            edicion del Monitor. Guardarlos en un solo campo obliga a adivinar despues
--            a que dijo que si cada persona, y eso no se adivina.
-- Valores: 'monitor' (una edicion cuando selle) · 'weekly' (un correo por semana).
CREATE TABLE IF NOT EXISTS monitor_leads (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  email   TEXT NOT NULL,
  ts      TEXT NOT NULL,
  ua      TEXT,
  origen  TEXT,
  lista   TEXT NOT NULL DEFAULT 'monitor'
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

-- La columna 'lista' llego DESPUES de que la tabla existiera. CREATE TABLE IF NOT EXISTS
-- no altera una tabla ya creada, asi que el ALTER va en scripts/migrar-lista.mjs, que
-- primero pregunta PRAGMA table_info y solo altera si falta. Un ALTER a secas aqui
-- reventaria el despliegue en la segunda corrida.
