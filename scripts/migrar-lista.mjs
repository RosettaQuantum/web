/**
 * Migracion idempotente: monitor_leads gana la columna `lista`.
 *
 * POR QUE NO VA EN EL .sql
 * ------------------------
 * `CREATE TABLE IF NOT EXISTS` no altera una tabla que ya existe, y SQLite no tiene
 * `ADD COLUMN IF NOT EXISTS`. Un `ALTER TABLE` suelto en el archivo de esquema funciona
 * la primera vez y revienta el despliegue todas las demas. Asi que se pregunta primero:
 * PRAGMA table_info, y solo se altera si la columna falta.
 *
 * SE MIDIO ANTES DE ESCRIBIRLO: la tabla tiene CERO filas (8-sep). O sea que nadie se ha
 * suscrito todavia y esta migracion no toca dato de nadie. Aun asi va como ALTER aditivo
 * con DEFAULT, no como recrear la tabla: el dia que haya filas, este mismo script tiene
 * que seguir siendo seguro.
 */
import { execFileSync } from "node:child_process";

export const CONSUMIDOR = {
  quien: "el despliegue a preview, antes de construir",
  hace: "no despliega: el endpoint escribiria en una columna que no existe y toda suscripcion fallaria",
};

const BASE = "rosettaq-ledger";
const wrangler = "./node_modules/.bin/wrangler";
const d1 = (sql) => JSON.parse(execFileSync(wrangler,
  ["d1", "execute", BASE, "--remote", "--json", "--command", sql], { encoding: "utf8" }));

const info = d1("PRAGMA table_info(monitor_leads)");
const columnas = (info[0]?.results || []).map((c) => c.name);
if (!columnas.length) { console.log("migrar-lista: la tabla aun no existe — la crea el esquema, con la columna dentro"); process.exit(0); }

if (columnas.includes("lista")) {
  console.log(`migrar-lista: ya esta · columnas: ${columnas.join(", ")}`);
} else {
  console.log(`migrar-lista: falta 'lista' · columnas: ${columnas.join(", ")}`);
  d1("ALTER TABLE monitor_leads ADD COLUMN lista TEXT NOT NULL DEFAULT 'monitor'");
  const despues = (d1("PRAGMA table_info(monitor_leads)")[0]?.results || []).map((c) => c.name);
  if (!despues.includes("lista")) { console.log("FALLA el ALTER no dejo la columna"); process.exit(1); }
  console.log(`migrar-lista: agregada · columnas: ${despues.join(", ")}`);
}
