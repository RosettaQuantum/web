#!/usr/bin/env node
/**
 * T6 del encargo de la landing pagada: que la medicion de /es/q no se pueda ensuciar ni filtrar.
 *
 * Los cuatro defectos que esto cierra, y ninguno es hipotetico — los cuatro son formas en que una
 * medicion de campana se arruina en la practica:
 *
 *  1. `ev` LIBRE. Si un tercero puede escribir cualquier evento, la tabla por la que despues se
 *     decide cuanto gastar en Google Ads queda con filas que nadie puso. Lista blanca, y lo que
 *     no esta se rechaza con 400 (es un error de quien integra, no del visitante).
 *  2. EL USER-AGENT CRUDO. El invariante escrito en db/usage.schema.sql es "ningun user-agent".
 *     Un UA crudo identifica mas que un hash de IP: trae dispositivo, sistema y version. Aqui se
 *     guarda la CLASE (`claseUA`), y esta prueba lo exige con un UA real de Chrome.
 *  3. LA SAL FIJA. Un `ip_hash` con sal constante es un identificador permanente por persona,
 *     que es exactamente lo que el encargo prohibe. Sin sal configurada NO se escribe el campo,
 *     en vez de caer a una sal por defecto.
 *  4. LA CLAVE EN EL QUERY STRING. Una clave en la URL queda escrita en cada registro que la URL
 *     atraviesa. Va en la cabecera, y la comparacion es de largo constante.
 *
 * `--self-test` corre sin red y sin base: las piezas son funciones puras a proposito.
 */

import { BIND_EVENTO, EVENTOS, LADOS, MAX, SQL_EVENTO, claveDe, claveOk, filaEvento, hostDe, ipHash } from "../lib/q-eventos.mjs";
import { claseUA, debeContar } from "../lib/hits.mjs";
import { readFileSync } from "node:fs";

export const CONSUMIDOR = {
  quien: "quien despliega el Worker y quien enciende una campana pagada en Google Ads",
  hace: "no abre la campana: la tabla por la que se decide cuanto gastar aceptaria filas que nadie puso, o guardaria el user-agent crudo y un ip_hash con sal fija, que es un identificador por persona",
};

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const fallos = [];
const ok = (cond, msg) => { if (!cond) fallos.push(msg); };

// 1 — `ev` por lista blanca
for (const malo of ["", null, "cualquiera", "DROP TABLE", "View", "view;--"]) {
  const r = filaEvento({ ev: malo }, { ua: CHROME });
  ok(!!r.error, `ev invalido aceptado: ${JSON.stringify(malo)}`);
}
// El espacio sobrante SI se acepta, y se normaliza. Lo escribo como prueba porque mi primera
// version lo esperaba rechazado y estaba equivocada: un cliente que manda "view " tiene un
// descuido, no una intencion, y lo que se guarda queda limpio igual. Rechazarlo seria un falso
// positivo, y un falso positivo retiene trabajo bueno.
{
  const r = filaEvento({ ev: "  view " }, { ua: CHROME });
  ok(!r.error && r.fila.ev === "view", `el espacio sobrante no se normalizo: ${JSON.stringify(r)}`);
}
for (const bueno of EVENTOS) {
  const r = filaEvento({ ev: bueno }, { ua: CHROME });
  ok(!r.error && r.fila.ev === bueno, `ev valido rechazado: ${bueno}`);
}
ok(!!filaEvento({ ev: "view", side: "otro" }, { ua: CHROME }).error, "side fuera de la lista aceptado");
for (const l of LADOS) ok(!filaEvento({ ev: "view", side: l }, { ua: CHROME }).error, `side valido rechazado: ${l}`);

// 2 — nunca el user-agent crudo
{
  const { fila } = filaEvento({ ev: "view" }, { ua: CHROME });
  ok(fila.ua === "browser", `el UA no se clasifico: ${fila.ua}`);
  ok(!String(fila.ua).includes("Mozilla"), "se guardo el user-agent CRUDO");
  ok(claseUA("ChatGPT-User/1.0") === "ai:ChatGPT-User", "un agente de IA no se reconoce");
}

// 3 — la sal: sin ella no hay hash, y con dias distintos el hash cambia
{
  ok((await ipHash("1.2.3.4", null)) === null, "se hasheo la IP sin sal configurada");
  ok((await ipHash(null, "sal:2026-11-18")) === null, "se hasheo una IP vacia");
  const a = await ipHash("1.2.3.4", "sal:2026-11-18");
  const b = await ipHash("1.2.3.4", "sal:2026-11-19");
  const c = await ipHash("1.2.3.4", "sal:2026-11-18");
  ok(a && a.length === 16, `el hash no tiene 16 hex: ${a}`);
  ok(a === c, "el mismo dia y la misma IP tienen que agrupar");
  ok(a !== b, "dos dias distintos NO pueden dar el mismo hash, o se puede seguir a alguien entre dias");
  ok(!String(a).includes("1.2.3.4"), "la IP quedo en el hash");
}

// 4 — la clave: cabecera, no query; y comparacion de largo constante
{
  ok(claveDe({ headers: { get: () => "Bearer secreta" } }) === "secreta", "no se lee Bearer de la cabecera");
  ok(claveDe({ headers: { get: () => null } }) === null, "sin cabecera deberia ser null");
  ok(claveOk("secreta", "secreta"), "la clave correcta no pasa");
  ok(!claveOk("secret", "secreta"), "una clave mas corta pasa");
  ok(!claveOk("", "secreta") && !claveOk(null, "secreta"), "una clave vacia pasa");
  ok(!claveOk("secreta", null) && !claveOk("secreta", ""), "sin clave esperada, cualquier clave pasa");

  // Esto comprueba la FORMA del codigo, no su comportamiento, y es a proposito: una comparacion
  // con `===` pasa todas las pruebas funcionales de arriba — la diferencia es el TIEMPO, que una
  // prueba asi no puede ver. Lo medi: al reemplazar la comparacion por `===`, el guardia seguia
  // verde. Un guardia que no puede ver lo que promete tiene que mirar el codigo o callarse.
  const fuente = readFileSync(new URL("../lib/q-eventos.mjs", import.meta.url), "utf8");
  const cuerpo = /export function claveOk\([\s\S]*?\n}/.exec(fuente)?.[0] || "";
  ok(/\|=/.test(cuerpo) && /for \(/.test(cuerpo), "claveOk dejo de comparar byte a byte: una comparacion con === filtra el prefijo correcto por tiempo");
  ok(!/return String\(entregada\) === String\(esperada\)/.test(cuerpo), "claveOk compara las cadenas completas con ===");
}

// 5 — topes y limpieza: un campo sin tope es un remitente decidiendo cuanto ocupa una fila
{
  const largo = "x".repeat(MAX * 3);
  const { fila } = filaEvento({ ev: "view", cta: largo, utm_campaign: `a\u0000b\nc` }, { ua: CHROME });
  ok(fila.cta.length === MAX, `el tope de ${MAX} no se aplico: ${fila.cta.length}`);
  ok(!/[\u0000-\u001f]/.test(fila.utm_campaign), "pasaron caracteres de control");
  ok(hostDe("https://ads.google.com/x/y?q=1") === "ads.google.com", "del referrer se guarda mas que el host");
  ok(hostDe("no-es-una-url") === null, "un referrer ilegible deberia ser null");
}

// 6 — la visita de /es/q entra al contador del sitio
{
  const pide = (p) => ({ method: "GET", url: `https://rosettaquantum.com${p}`, headers: { get: () => null } });
  ok(debeContar(pide("/es/q"), { status: 200 }), "/es/q no se cuenta en hits");
  ok(debeContar(pide("/es/q/"), { status: 200 }), "/es/q/ no se cuenta en hits");
  ok(!debeContar(pide("/es/q"), { status: 404 }), "un 404 no puede contar como visita");
  ok(!debeContar({ ...pide("/es/q"), method: "POST" }, { status: 200 }), "un POST no es una visita");
}

// 7 — el INSERT y sus valores tienen que contar lo mismo. Es el defecto mas tonto y el mas
// silencioso: agregar una columna al SQL y olvidar el valor no falla al escribir el codigo, falla
// en produccion la primera vez que alguien entra a la landing.
{
  const huecos = (SQL_EVENTO.match(/\?/g) || []).length;
  const columnas = (/\(([^)]*)\) VALUES/.exec(SQL_EVENTO)?.[1] || "").split(",").length;
  const { fila } = filaEvento({ ev: "view" }, { ua: CHROME });
  const valores = BIND_EVENTO(fila).length;
  ok(huecos === valores, `el INSERT tiene ${huecos} huecos y se pasan ${valores} valores`);
  ok(columnas === valores, `el INSERT nombra ${columnas} columnas y se pasan ${valores} valores`);
  ok(BIND_EVENTO(fila).every((v) => v === null || typeof v === "string"), "algun valor no es texto ni null: D1 no acepta objetos");
}

if (fallos.length) {
  console.error(`[q-eventos] BLOQUEADO: ${fallos.length} defecto(s).`);
  for (const f of fallos) console.error(`   ${f}`);
  process.exit(1);
}
console.log("[q-eventos] sin defectos: ev por lista blanca, clase de agente y no UA crudo, sal rotativa, clave en cabecera, topes, y /es/q contada.");
