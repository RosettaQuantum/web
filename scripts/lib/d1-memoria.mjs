// Una D1 de mentira con SQL de verdad (13-nov-2026): SQLite en memoria (node:sqlite) detrás de la
// misma forma que usa el Worker —prepare().bind().first()/all()/run() y batch()—, con el esquema
// REAL de db/*.schema.sql aplicado. Para los guardias de Q-Ready Verified: una compuerta escrita en
// SQL sólo se prueba ejecutando ese SQL; un doble que devuelve lo que uno espera se da la razón solo.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const limpio = (fila) => (fila ? { ...fila } : null);

export function d1EnMemoria(...esquemas) {
  const db = new DatabaseSync(":memory:");
  for (const e of esquemas) db.exec(readFileSync(e, "utf8"));
  const stmt = (sql, args = []) => ({
    sql, args,
    bind: (...a) => stmt(sql, a),
    first: async () => limpio(db.prepare(sql).all(...args)[0]),
    all: async () => ({ results: db.prepare(sql).all(...args).map(limpio) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
  });
  return {
    sqlite: db,
    prepare: (sql) => stmt(sql),
    batch: async (lista) => {
      db.exec("BEGIN");
      try {
        const out = lista.map((s) => ({ results: db.prepare(s.sql).all(...s.args).map(limpio) }));
        db.exec("COMMIT");
        return out;
      } catch (e) { db.exec("ROLLBACK"); throw e; }
    },
  };
}
