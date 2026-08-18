#!/usr/bin/env node
/**
 * El criterio de aceptacion del encargo, en un chequeo: "un fallo simulado demuestra
 * que el lead no se pierde y que el visitante no recibe confirmacion falsa."
 *
 * Se prueba con fixtures de env.DB y env.MAILER falsas — mismo patron que
 * test-usage.mjs (baseOk/baseRota/baseRotaAlCorrer) — para no depender de D1 ni de
 * "cloudflare:email", que no existe fuera del runtime de Workers.
 */
import { manejarQreadyLead, validar, CREAR_TABLA } from "../lib/qready-lead.mjs";

let ok = 0, mal = 0;
const prueba = (n, c, d = "") => c ? (ok++, console.log(`  ok   ${n}`))
                                   : (mal++, console.log(`  FALLA ${n}${d ? "\n         " + d : ""}`));

const LEAD_OK = { legal: "Acme Bank", name: "Jane CISO", email: "jane@acme.com", phone: "+1", notes: "urgente" };

// Una base que anota lo escrito, y variantes rotas — igual que test-usage.mjs.
const baseOk = () => {
  const escrito = [];
  return { escrito, prepare: sql => ({ bind: (...a) => ({
    run: async () => { escrito.push({ sql, a }); return { meta: { last_row_id: escrito.length } }; }
  }) }), exec: async () => {} };
};
const baseSinTabla = () => {
  // Simula el primer envio de siempre: la tabla no existe hasta que se crea sola.
  let creada = false;
  const escrito = [];
  return { escrito, get creada() { return creada; },
    prepare: sql => ({ bind: (...a) => ({ run: async () => {
      if (/^INSERT/.test(sql) && !creada) throw new Error("no such table: qready_leads");
      escrito.push({ sql, a }); return { meta: { last_row_id: escrito.length } };
    } }) }),
    exec: async () => { creada = true; } };
};
const baseRota = () => ({ prepare: () => { throw new Error("D1 caida"); }, exec: async () => {} });

const enviarOk = async () => {};
const enviarRoto = async () => { throw new Error("MAILER rechazo el mensaje"); };

// --------------------------------------------------------------- validacion
prueba("rechaza sin razon social", validar({ name: "x", email: "a@b.com" }) !== null);
prueba("rechaza email invalido", validar({ ...LEAD_OK, email: "no-es-un-email" }) !== null);
prueba("acepta el caso valido", validar(LEAD_OK) === null);

// -------------------------------------------------------- el caso feliz
{
  const db = baseOk();
  const r = await manejarQreadyLead(LEAD_OK, { DB: db }, enviarOk);
  prueba("caso feliz: ok:true", r.cuerpo.ok === true, JSON.stringify(r));
  prueba("caso feliz: emailed:true", r.cuerpo.emailed === true, JSON.stringify(r.cuerpo));
  prueba("caso feliz: escribio el INSERT y el UPDATE", db.escrito.length === 2, JSON.stringify(db.escrito));
}

// --------------------------------------- EL CASO QUE MAS IMPORTA: D1 caida
// "el visitante no recibe confirmacion falsa"
{
  const r = await manejarQreadyLead(LEAD_OK, { DB: baseRota() }, enviarOk);
  prueba("D1 caida: ok:false, NO confirma", r.cuerpo.ok === false, JSON.stringify(r));
  prueba("D1 caida: status 500, no 200", r.status === 500);
}

// --------------------------------------- EL OTRO CASO: correo caido
// "el lead no se pierde" — el dato ya esta a salvo, aunque el aviso falle.
{
  const db = baseOk();
  const r = await manejarQreadyLead(LEAD_OK, { DB: db }, enviarRoto);
  prueba("correo caido: ok:true igual — el lead SI se guardo", r.cuerpo.ok === true, JSON.stringify(r));
  prueba("correo caido: emailed:false, sin fingir que se mando", r.cuerpo.emailed === false);
  prueba("correo caido: el UPDATE registra el motivo del fallo",
    db.escrito[1] && db.escrito[1].a[1] && db.escrito[1].a[1].includes("MAILER rechazo"),
    JSON.stringify(db.escrito[1]));
}

// ------------------------------------------------- autocreacion perezosa
{
  const db = baseSinTabla();
  const r = await manejarQreadyLead(LEAD_OK, { DB: db }, enviarOk);
  prueba("tabla ausente: se crea sola y el lead SI se guarda", r.cuerpo.ok === true && db.creada, JSON.stringify(r));
}

// --------------------------------------------------------- entrada invalida
{
  const db = baseOk();
  const r = await manejarQreadyLead({ email: "solo@esto.com" }, { DB: db }, enviarOk);
  prueba("campos faltantes: ok:false y NO toca la base", r.cuerpo.ok === false && db.escrito.length === 0,
    JSON.stringify({ r, escrito: db.escrito }));
}

prueba("CREAR_TABLA menciona las columnas de aviso", /emailed/.test(CREAR_TABLA) && /email_error/.test(CREAR_TABLA));

console.log(`\n${ok} pasaron, ${mal} fallaron`);
process.exit(mal ? 1 : 0);
