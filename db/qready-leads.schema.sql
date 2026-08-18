-- Leads del formulario Enterprise (co-lead, tier=l3) de /q-ready/checkout.
--
-- Esta tabla NO se aplica a mano: el Worker la crea sola en el primer envio
-- (autocreacion perezosa, ver lib/qready-lead.mjs) porque el token de deploy local no
-- tiene D1:Edit. Este archivo es la documentacion del esquema real, no el mecanismo
-- que lo instala.
CREATE TABLE IF NOT EXISTS qready_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  legal TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  tier TEXT NOT NULL DEFAULT 'l3',
  lang TEXT NOT NULL DEFAULT 'en',
  source TEXT NOT NULL DEFAULT 'qready-checkout',
  -- El registro se abre AL RECIBIR: emailed/email_error se actualizan DESPUES sobre
  -- esta misma fila. Un correo que falla no borra el lead; solo lo deja documentado.
  emailed INTEGER NOT NULL DEFAULT 0,
  email_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
