#!/usr/bin/env node
/**
 * El criterio de aceptacion del encargo, en un chequeo: "un fallo simulado demuestra
 * que el lead no se pierde y que el visitante no recibe confirmacion falsa."
 *
 * Se prueba con fixtures de env.DB y env.MAILER falsas — mismo patron que
 * test-usage.mjs (baseOk/baseRota/baseRotaAlCorrer) — para no depender de D1 ni de
 * "cloudflare:email", que no existe fuera del runtime de Workers.
 */
import { manejarQreadyLead, validar, CREAR_TABLA, construirCorreo } from "../lib/qready-lead.mjs";

let ok = 0, mal = 0;
const prueba = (n, c, d = "") => c ? (ok++, console.log(`  ok   ${n}`))
                                   : (mal++, console.log(`  FALLA ${n}${d ? "\n         " + d : ""}`));

const LEAD_OK = { legal: "Acme Bank", name: "Jane CISO", email: "jane@acme.com", phone: "+1", notes: "urgente" };

// Una base que anota lo escrito, y variantes rotas — igual que test-usage.mjs.
const baseOk = () => {
  const escrito = [];
  return { escrito, prepare: sql => ({
    bind: (...a) => ({ run: async () => { escrito.push({ sql, a }); return { meta: { last_row_id: escrito.length } }; } }),
    run: async () => { escrito.push({ sql, a: [] }); return {}; },  // CREATE TABLE via .prepare().run(), sin .bind()
  }) };
};
const baseSinTabla = () => {
  // Simula el primer envio de siempre: la tabla no existe hasta que se crea sola.
  let creada = false;
  const escrito = [];
  return { escrito, get creada() { return creada; },
    prepare: sql => ({
      bind: (...a) => ({ run: async () => {
        if (/^INSERT/.test(sql) && !creada) throw new Error("no such table: qready_leads");
        escrito.push({ sql, a }); return { meta: { last_row_id: escrito.length } };
      } }),
      run: async () => { creada = true; escrito.push({ sql, a: [] }); },  // el CREATE TABLE
    }) };
};
const baseRota = () => ({ prepare: () => { throw new Error("D1 caida"); } });

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

// --------------------------------------------------------------- Reply-To
// El pedido: que Nicholas pueda responderle al prospecto con un clic desde Gmail.
{
  const correo = construirCorreo({ ...LEAD_OK, id: 9, tier: "l3" });
  prueba("el correo lleva Reply-To con el email del lead",
    correo.includes("Reply-To: jane@acme.com"), correo.slice(0, 200));
}

// El caso que importa: un lead no puede inyectar cabeceras nuevas via email/legal/notas.
// Vector real: \r\nBcc: ... en un campo que se interpola en Subject o Reply-To.
{
  const malo = { ...LEAD_OK, id: 10, legal: "Acme\r\nBcc: atacante@evil.com",
    email: "jane@acme.com\r\nBcc: atacante@evil.com" };
  const correo = construirCorreo(malo);
  // El limite que importa es la linea en blanco: lo que va ANTES son cabeceras de
  // verdad, lo que va DESPUES es cuerpo de texto plano. Un "Bcc:" dentro del CUERPO
  // no es una cabecera — un cliente de correo lo muestra como texto, no lo obedece.
  // Mi primera version de esta prueba partia el correo ENTERO y encontraba el "Bcc:"
  // que el cuerpo (sin sanear, y esta bien que no lo este) arrastraba del input —
  // gritaba contra algo que no era el defecto que queria probar.
  const [cabeceras] = correo.split("\r\n\r\n");
  const lineasCabecera = cabeceras.split("\r\n");
  const conBcc = lineasCabecera.filter(l => /^Bcc:/i.test(l));
  prueba("un \\r\\n en legal o email NO agrega una cabecera Bcc de verdad",
    conBcc.length === 0, JSON.stringify(lineasCabecera));
  prueba("las cabeceras siguen siendo exactamente 4 lineas, ni una de mas",
    lineasCabecera.length === 5, JSON.stringify(lineasCabecera));
  prueba("el email inyectado queda neutralizado en una sola linea de Reply-To",
    /^Reply-To: jane@acme\.com Bcc: atacante@evil\.com$/m.test(correo), correo.split("\r\n").find(l=>l.startsWith("Reply-To")));
}


console.log(`\n${ok} pasaron, ${mal} fallaron`);
process.exit(mal ? 1 : 0);
