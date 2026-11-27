#!/usr/bin/env node
// Guardia de las dos capas de medición (27-nov-2026, lib/capas.mjs).
//
// Lo que defiende, con SQL de verdad (d1-memoria) y no con dobles que se den la razón:
//   1. exclusión: un dominio con exclusión CONFIRMADA y no revocada queda fuera, y sus subdominios
//      también; una exclusión sin confirmar o revocada no excluye (nadie excluye a un tercero).
//   2. capa 2 sólo con dueño verificado EN PRODUCCIÓN **y** autorización vigente; todo lo demás —y
//      una base caída— es capa 1.
//   3. la exclusión falla cerrada salvo que la tabla no exista todavía.
//   4. manejarSondas revisa la exclusión ANTES de cualquier sondeo, y toma la capa de capaDe.
// Más dos mutaciones: sin el filtro de confirmación, o sin la revisión en manejarSondas, el guardia grita.
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { d1EnMemoria } from "./lib/d1-memoria.mjs";

export const CONSUMIDOR = { quien: "el build (prebuild): bloquea el despliegue", hace: "si grita, una medición tocaría a un dominio excluido o usaría la capa 2 sin autorización: se corrige lib/capas.mjs o su consumidor antes de subir" };

const raiz = new URL("../", import.meta.url);
const ruta = (p) => fileURLToPath(new URL(p, raiz));
let fallas = 0;
const igual = (a, b, m) => { const ok = JSON.stringify(a) === JSON.stringify(b); console.log(`  ${ok ? "✓" : "✗"} ${m}${ok ? "" : ` — esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`}`); if (!ok) fallas++; };

const ESQ = [ruta("db/qready-verificado.schema.sql"), ruta("db/capas.schema.sql")];
const COLS = ["autorizacion_version TEXT", "autorizacion_utc TEXT", "autorizacion_retirada_utc TEXT"];
function base({ columnas = true } = {}) {
  const db = d1EnMemoria(...ESQ);
  if (columnas) for (const c of COLS) db.sqlite.exec(`ALTER TABLE qready_dominios ADD COLUMN ${c}`);
  return db;
}
const tok = () => [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
const exclusion = (db, dominio, { confirmado = true, revocado = false } = {}) => db.sqlite.prepare(
  "INSERT INTO qready_exclusiones (token, dominio, correo_sha256, pedido_utc, confirmado_utc, revocado_utc) VALUES (?,?,?,?,?,?)")
  .run(tok(), dominio, "x".repeat(64), "2026-11-27T00:00:00Z", confirmado ? "2026-11-27T01:00:00Z" : null, revocado ? "2026-11-27T02:00:00Z" : null);
const verificado = (db, dominio, { entorno = "produccion", autoriza = true, retirada = false, verif = true } = {}) => db.sqlite.prepare(
  "INSERT INTO qready_dominios (token, dominio, sector, publico, entorno, creado_utc, verificado_en, autorizacion_version, autorizacion_utc, autorizacion_retirada_utc) VALUES (?,?,?,?,?,?,?,?,?,?)")
  .run(tok(), dominio, "banca", 0, entorno, "2026-11-27T00:00:00Z", verif ? "2026-11-27T00:00:00Z" : null,
    autoriza ? "RQ-AUTORIZACION-1" : null, autoriza ? "2026-11-27T00:00:00Z" : null, retirada ? "2026-11-28T00:00:00Z" : null);

async function prueba(C, etiqueta = "") {
  const pre = etiqueta ? `${etiqueta}: ` : "";
  // 1 · exclusión
  let db = base(); exclusion(db, "banco.example");
  igual(await C.excluido(db, "banco.example"), true, `${pre}grito: exclusión confirmada excluye`);
  igual(await C.excluido(db, "openfinance-desa.banco.example"), true, `${pre}grito: excluye también sus subdominios`);
  igual(await C.excluido(db, "otrobanco.example"), false, `${pre}silencio: otro dominio no queda excluido`);
  db = base(); exclusion(db, "banco.example", { confirmado: false });
  igual(await C.excluido(db, "banco.example"), false, `${pre}silencio: una exclusión sin confirmar no excluye`);
  db = base(); exclusion(db, "banco.example", { revocado: true });
  igual(await C.excluido(db, "banco.example"), false, `${pre}silencio: una exclusión revocada no excluye`);
  // 3 · falla cerrada
  igual(await C.excluido(d1EnMemoria(ESQ[0]), "banco.example"), false, `${pre}sin la tabla (esquema sin aplicar) no hay exclusiones`);
  const rota = { prepare: () => { throw new Error("base caída"); } };
  const errOrig = console.error; console.error = () => {};
  igual(await C.excluido(rota, "banco.example"), true, `${pre}grito: con la base caída, cuenta como excluido`);
  // 2 · capa
  db = base(); verificado(db, "banco.example");
  igual(await C.capaDe(db, "banco.example"), 2, `${pre}silencio: verificado en producción y con autorización → capa 2`);
  for (const [k, o] of Object.entries({ "sin autorización": { autoriza: false }, "autorización retirada": { retirada: true },
    "sin verificar": { verif: false }, "entorno de prueba": { entorno: "preview-prueba" } })) {
    db = base(); verificado(db, "banco.example", o);
    igual(await C.capaDe(db, "banco.example"), 1, `${pre}grito: ${k} → capa 1`);
  }
  igual(await C.capaDe(base(), "banco.example"), 1, `${pre}sin fila → capa 1`);
  igual(await C.capaDe(rota, "banco.example"), 1, `${pre}base caída → capa 1`);
  igual(await C.capaDe(d1EnMemoria(...ESQ), "banco.example"), 1, `${pre}sin las columnas nuevas (esquema sin aplicar) → capa 1`);
  console.error = errOrig;
  igual(C.hostsSsh(1, "banco.example", "www.banco.example", ["vpn.banco.example"]), ["banco.example", "www.banco.example"], `${pre}capa 1: SSH sólo en dominio y www`);
  igual(C.hostsSsh(2, "banco.example", "www.banco.example", ["vpn.banco.example"]), ["banco.example", "www.banco.example", "vpn.banco.example"], `${pre}capa 2: SSH en todos`);
}

console.log("capas · lib/capas.mjs");
await prueba(await import(ruta("lib/capas.mjs")));

// 4 · manejarSondas: la exclusión va antes que cualquier sondeo, y la capa sale de capaDe
const inf = readFileSync(ruta("lib/informe-envivo.mjs"), "utf8").replace(/\/\/.*$/gm, "");
const cuerpo = inf.slice(inf.indexOf("export async function manejarSondas"));
const iEx = cuerpo.indexOf("await excluido(env.DB, dominio)"), iSondeo = cuerpo.search(/medirBorde\(|sondaEndpoint\)|sondaSsh\)/);
igual(iEx > 0 && iSondeo > 0 && iEx < iSondeo, true, "manejarSondas revisa la exclusión antes del primer sondeo");
igual(/const capa = await capaDe\(env\.DB, dominio\)/.test(cuerpo) && /capa === 2 \? CAPAS\[2\]\.max_nombres : MAX_SENSIBLES/.test(cuerpo), true, "manejarSondas toma la capa y el tope de lib/capas.mjs");
igual(/"user-agent": "RosettaQ/.test(inf), false, "ninguna conexión HTTP lleva un User-Agent escrito a mano: sale de USER_AGENT");

// MUTACIÓN: sin el filtro de confirmación, una exclusión pedida por cualquiera excluiría a un tercero
const tmp = mkdtempSync(join(tmpdir(), "capas-"));
const src = readFileSync(ruta("lib/capas.mjs"), "utf8");
const mut = src.replace("WHERE confirmado_utc IS NOT NULL AND revocado_utc IS NULL AND dominio IN", "WHERE dominio IN")
  .replace('"../public/js/qex-nucleo.mjs"', JSON.stringify(new URL("public/js/qex-nucleo.mjs", raiz).href));
if (mut === src) { console.log("  ✗ la mutación no entró: el guardia está mudo"); fallas++; }
else {
  writeFileSync(join(tmp, "capas.mjs"), mut);
  const M = await import(join(tmp, "capas.mjs"));
  const db = base(); exclusion(db, "banco.example", { confirmado: false });
  igual(await M.excluido(db, "banco.example"), true, "MUTACIÓN: sin el filtro de confirmación, la exclusión sin confirmar excluye (el guardia lo ve)");
}

if (fallas) { console.error(`\ncapas: ${fallas} falla(s)`); process.exit(1); }
console.log("\ncapas: verde");
