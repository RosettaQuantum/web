// RQ.T · pruebas del descubrimiento de proveedores (lib/proveedores-*.mjs) y de su llave del preview.
// Por cada regla, un caso que GRITA y uno que se CALLA (CLAUDE.md §4 bis). Sin red: sólo fijas.
//   node test/proveedores.test.mjs
import { readFileSync } from "node:fs";
import * as C from "../lib/proveedores-catalogo.mjs";
import { descubrir, diffCorridas, textoTxt, organizacionDe, leerCadena } from "../lib/proveedores-descubrir.mjs";

let pasaron = 0, fallaron = 0;
const si = (cond, msg) => { if (cond) { pasaron++; console.log(`  ok    ${msg}`); } else { fallaron++; console.log(`  FALLA ${msg}`); } };
const D = "ejemplo.cl";
const r = (status, answer = []) => ({ status, answer });
const A = (name, data) => ({ name, type: 1, data });
const CN = (name, data) => ({ name, type: 5, data: data + "." });
const TXT = (name, data) => ({ name, type: 16, data: `"${data}"` });
const base = (dns = {}, ct = { fuentes: [] }) => ({ dominio: D, medido_utc: "2026-11-24T12:00:00Z", dns, ct });
const filasDe = (res, s) => res.filas.filter((f) => f.senal === s);

// ════ 1 · paridad: mover las tablas no cambió la ficha pública ═══════════════════════
console.log("1 · paridad con el código de antes (fijas generadas desde git HEAD afc8a11)");
{
  const P = JSON.parse(readFileSync(new URL("./proveedores-paridad.json", import.meta.url), "utf8"));
  const malMx = P.mx.filter(([m, n]) => C.proveedorMx(m) !== n);
  si(P.mx.length >= 14 && !malMx.length, `proveedorMx: ${P.mx.length - malMx.length} de ${P.mx.length} iguales${malMx.length ? " · distintos: " + malMx.map((x) => x[0]).join(", ") : ""}`);
  const malCdn = P.cdn.filter(([c, n]) => C.cdnDeCadena(c) !== n);
  si(P.cdn.length >= 11 && !malCdn.length, `cdn de la cadena CNAME: ${P.cdn.length - malCdn.length} de ${P.cdn.length} iguales`);
  const fuente = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  si(!/const PROVEEDOR_MX\s*=/.test(fuente("../lib/informe-envivo.mjs")) && /from "\.\/proveedores-catalogo\.mjs"/.test(fuente("../lib/informe-envivo.mjs")),
    "la tabla de MX vive en UN lugar (informe-envivo la importa)");
  si(!/edgekey\\\.net/.test(fuente("../lib/borde-envivo.mjs")) && /cdnDeCadena/.test(fuente("../lib/borde-envivo.mjs")),
    "la tabla del CDN vive en UN lugar (borde-envivo la importa)");
}

// ════ 2 · el catálogo calza por etiqueta, no por cadena ═════════════════════════════
console.log("\n2 · catálogo");
si(C.clasificarNombre("wild.ejemplo.edgekey.net")?.proveedor === "Akamai", "grito: x.edgekey.net → Akamai");
si(C.clasificarNombre("fooedgekey.net") === null, "silencio: fooedgekey.net no es Akamai (calza por etiqueta)");
si(C.clasificarNombre("x.cloudapp.azure.com")?.servicio === "Azure", "el sufijo más largo gana (cloudapp.azure.com)");
si(C.verificacionTxt("MS=ms12345678")?.proveedor === "Microsoft", "grito: MS=ms… → Microsoft");
si(C.verificacionTxt("nota: google-site-verification= ya no se usa") === null, "silencio paradójico: el patrón DESCRITO en un TXT no es el patrón");
si(C.caDeEmisor("DigiCert, Inc.") === "DigiCert" && C.empresaDeCa("Amazon Trust Services") === "Amazon", "CA y empresa normalizadas");
si(organizacionDe('C=US, O="Entrust, Inc.", OU=See www.entrust.net, CN=X') === "Entrust, Inc.", "O= entre comillas con coma adentro");
si(textoTxt('"VISA=" "0123456789ABCDEF0123456789ABCDEF"') === "VISA=0123456789ABCDEF0123456789ABCDEF", "TXT partido en dos cadenas se une sin separador");

// ════ 3 · señal vacía → «sin dato», nunca 0 ═════════════════════════════════════════
console.log("\n3 · una señal que no devuelve nada dice «sin dato» y su conteo es null");
{
  const vacio = descubrir(base({ [`${D}|MX`]: r("NOERROR"), [`${D}|NS`]: { error: "no respondió a tiempo" }, [`${D}|TXT`]: r("NXDOMAIN") }));
  for (const s of ["RQ.T.01", "RQ.T.02", "RQ.T.03", "RQ.T.04", "RQ.T.05", "RQ.T.06", "RQ.T.07"]) {
    const ps = vacio.por_senal[s];
    si(ps.estado === "sin dato" && ps.proveedores === null && filasDe(vacio, s).every((f) => f.estado === "sin dato"),
      `silencio: ${s} sin respuesta → «sin dato», proveedores null (no 0)`);
  }
  si(vacio.resumen.proveedores_descubiertos === 0 && vacio.proveedores.length === 0, "sin datos no aparece ningún proveedor");
  si(filasDe(vacio, "RQ.T.04")[0].evidencia.includes("no respondió"), "la fila dice POR QUÉ no hay dato");
  const con = descubrir(base({ [`${D}|MX`]: r("NOERROR", [{ name: D, type: 15, data: "10 mx1.hc1-55.iphmx.com." }]) }));
  si(con.por_senal["RQ.T.02"].proveedores === 1 && filasDe(con, "RQ.T.02")[0].proveedor === "Cisco", "grito: un MX de iphmx.com → Cisco, conteo 1");
  // Una señal que SÍ responde pero sin terceros: con dato y conteo 0 (eso sí es una medición).
  const soloIp = descubrir(base({ [`${D}|TXT`]: r("NOERROR", [TXT(D, "v=spf1 ip4:1.2.3.0/24 -all")]) }));
  si(soloIp.por_senal["RQ.T.03"].estado === "con dato" && soloIp.por_senal["RQ.T.03"].proveedores === 0, "SPF que sólo tiene ip4: con dato y 0 proveedores, no «sin dato»");
}

// ════ 4 · un TXT que no es de SaaS no inventa proveedor ═════════════════════════════
console.log("\n4 · TXT de verificación");
{
  const ruido = descubrir(base({ [`${D}|TXT`]: r("NOERROR", [TXT(D, "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"), TXT(D, "v=spf1 -all"), TXT(D, "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo0MTIzNDU2Nzg=")]) }));
  si(filasDe(ruido, "RQ.T.07").every((f) => f.proveedor === null) && ruido.por_senal["RQ.T.07"].proveedores === 0,
    "silencio: tokens sin patrón → ningún proveedor (con dato, 0)");
  si(ruido.por_senal["RQ.T.07"].denominador.sin_patron === 2 && ruido.por_senal["RQ.T.07"].denominador.spf === 1, "y entran al denominador: 2 sin patrón, 1 SPF");
  const conMs = descubrir(base({ [`${D}|TXT`]: r("NOERROR", [TXT(D, "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"), TXT(D, "MS=ms123"), TXT(D, "docusign=8b94")]) }));
  si(filasDe(conMs, "RQ.T.07").map((f) => f.proveedor).join() === "DocuSign,Microsoft", "grito: MS= y docusign= → Microsoft y DocuSign, el token no");
}

// ════ 5 · CNAME: borde, SaaS, externo sin clasificar, propio ════════════════════════
console.log("\n5 · nombres de CT → CNAME");
{
  const ct = { fuentes: [{ fuente: "crt.sh", ok: true, certificados: [
    { nombres: ["www.ejemplo.cl", "ayuda.ejemplo.cl", "raro.ejemplo.cl", "interno.ejemplo.cl", "*.ejemplo.cl", "ejemplo.cl.otro.com"], emisor_dn: "C=US, O=DigiCert Inc, CN=X", not_after: "2027-01-01T00:00:00" }] }] };
  const res = descubrir(base({
    [`www.${D}|A`]: r("NOERROR", [CN(`www.${D}`, "x.edgekey.net"), A("e1.akamaiedge.net", "23.1.1.1")]),
    [`ayuda.${D}|A`]: r("NOERROR", [CN(`ayuda.${D}`, "ejemplo.zendesk.com"), A("ejemplo.zendesk.com", "1.1.1.1")]),
    [`raro.${D}|A`]: r("NOERROR", [CN(`raro.${D}`, "raro.us.v2.desconocido.io")]),
    [`interno.${D}|A`]: r("NOERROR", [CN(`interno.${D}`, "lb.ejemplo.cl"), A("lb.ejemplo.cl", "2.2.2.2")]),
  }, ct));
  si(filasDe(res, "RQ.T.01").some((f) => f.proveedor === "Akamai"), "grito: www → edgekey.net → Akamai en RQ.T.01");
  si(filasDe(res, "RQ.T.06").some((f) => f.proveedor === "Zendesk" && f.clasificado), "grito: ayuda → zendesk.com → Zendesk en RQ.T.06");
  const raro = filasDe(res, "RQ.T.06").find((f) => f.proveedor === "desconocido.io");
  si(raro && !raro.clasificado && !res.proveedores.some((p) => p.proveedor === "desconocido.io"), "silencio: un destino desconocido queda «sin clasificar» y NO entra al conteo");
  si(!res.filas.some((f) => /interno/.test(f.evidencia)), "silencio: un CNAME a otro nombre del mismo dominio no es un tercero");
  si(res.por_senal["RQ.T.06"].denominador.nombres_ct === 4, "comodines y nombres de otro dominio no cuentan (4 nombres de ejemplo.cl)");
  si(leerCadena("a.ejemplo.cl", ["a.ejemplo.cl.edgekey.net", "e1.akamaiedge.net"], D).length === 1, "Akamai dos veces en la cadena es UN hallazgo");
}

// ════ 6 · SPF: se sigue el árbol; un include propio no es tercero ═══════════════════
console.log("\n6 · SPF");
{
  const res = descubrir(base({ [`${D}|TXT`]: r("NOERROR", [TXT(D, "v=spf1 include:_spf.ejemplo.cl include:spf.protection.outlook.com -all")]),
    [`_spf.ejemplo.cl|TXT`]: r("NOERROR", [TXT("_spf.ejemplo.cl", "v=spf1 include:spf-1.pphosted.com ip4:1.1.1.1 -all")]) }));
  const ps = filasDe(res, "RQ.T.03").map((f) => f.proveedor).sort().join();
  si(ps === "Microsoft,Proofpoint", `grito: Microsoft directo y Proofpoint a través del include propio (${ps})`);
  si(!res.filas.some((f) => f.proveedor === "ejemplo.cl"), "silencio: el include propio no aparece como proveedor");
}

// ════ 7 · CT + CAA ═══════════════════════════════════════════════════════════════════
console.log("\n7 · emisores");
{
  const ct = { fuentes: [{ fuente: "crt.sh", ok: true, certificados: [
    { nombres: ["a.ejemplo.cl"], emisor_dn: "C=US, O=Let's Encrypt, CN=R3", not_after: "2027-01-01T00:00:00" },
    { nombres: ["b.ejemplo.cl"], emisor_dn: "C=US, O=Symantec Corporation, CN=X", not_after: "2019-01-01T00:00:00" }] },
    { fuente: "Cert Spotter", ok: false, error: "Cert Spotter respondió 429" }] };
  const res = descubrir(base({ [`${D}|CAA`]: r("NOERROR", [{ name: D, type: 257, data: '0 issue "digicert.com"' }, { name: D, type: 257, data: '0 iodef "mailto:x@ejemplo.cl"' }]) }, ct));
  const ps = filasDe(res, "RQ.T.05").filter((f) => f.proveedor).map((f) => f.proveedor).sort().join();
  si(ps === "DigiCert,Let's Encrypt", `grito: CAA digicert + CT vigente de Let's Encrypt (${ps}); iodef no es una CA`);
  si(!res.proveedores.some((p) => /Symantec/.test(p.proveedor)) && filasDe(res, "RQ.T.05").some((f) => /sólo con certificados vencidos.*Symantec/.test(f.evidencia)),
    "silencio: un emisor sólo con certificados vencidos no es proveedor actual, pero se declara");
  si(res.por_senal["RQ.T.05"].denominador.ct_fuentes.find((f) => f.fuente === "Cert Spotter").certificados === null, "la fuente que falló declara null, no 0");
  const par = descubrir(base({}, { fuentes: [{ fuente: "Cert Spotter", ok: true, parcial: "página 2: Cert Spotter respondió 429",
    certificados: [{ nombres: ["a.ejemplo.cl"], emisor_dn: "C=US, O=Let's Encrypt, CN=R3", not_after: "2027-01-01" }] }] }));
  si(filasDe(par, "RQ.T.05").some((f) => /PARCIAL.*429/.test(f.evidencia)) && par.por_senal["RQ.T.05"].denominador.ct_fuentes[0].parcial,
    "grito: una fuente de CT que se cortó a mitad se declara PARCIAL, en la fila y en el denominador");
  si(!filasDe(descubrir(base({}, ct)), "RQ.T.05").some((f) => /PARCIAL/.test(f.evidencia)), "silencio: una fuente completa no dice PARCIAL");
  const sinCt = descubrir(base({}, { fuentes: [{ fuente: "crt.sh", ok: false, error: "crt.sh respondió 502" }] }));
  si(sinCt.por_senal["RQ.T.05"].estado === "sin dato" && /502/.test(filasDe(sinCt, "RQ.T.05")[0].evidencia), "CT caído y sin CAA → «sin dato» con la razón");
}

// ════ 8 · declarados y estabilidad ═══════════════════════════════════════════════════
console.log("\n8 · declarados, y dos corridas sobre los mismos insumos");
{
  const ins = base({ [`${D}|NS`]: r("NOERROR", [{ name: D, type: 2, data: "a1.akam.net." }]),
    [`${D}|MX`]: r("NOERROR", [{ name: D, type: 15, data: "10 x.mail.protection.outlook.com." }]) });
  const sin = descubrir(ins);
  si(sin.resumen.no_declarados === null && /No hay lista declarada/.test(sin.resumen.nota), "sin lista: no_declarados es null y lo dice");
  const con = descubrir(ins, { declarados: ["akamai"] });
  si(con.resumen.no_declarados === 1 && con.no_declarados[0] === "Microsoft", "con lista [akamai]: 1 no declarado (Microsoft)");
  const a = descubrir(ins), b = descubrir(JSON.parse(JSON.stringify(ins)));
  si(JSON.stringify(a) === JSON.stringify(b) && diffCorridas(a, b).iguales, "mismos insumos → misma salida, byte a byte");
  const otro = descubrir(base({ [`${D}|NS`]: r("NOERROR", [{ name: D, type: 2, data: "x.ns.cloudflare.com." }]) }));
  const d = diffCorridas(a, otro);
  si(!d.iguales && !d.resultado_igual && d.pares_solo_en_b.some((x) => /Cloudflare/.test(x)), "grito: el diff ve un proveedor que cambió");
  // silencio: misma señal y proveedor, distinta evidencia (p.ej. crt.sh contestó en una y no en la otra)
  const ev = JSON.parse(JSON.stringify(a)); ev.filas[0].evidencia += " · crt.sh 1873";
  const e = diffCorridas(a, ev);
  si(e.resultado_igual && !e.iguales, "silencio: cambia sólo la evidencia → resultado igual, evidencia distinta (se muestra)");
}

// ════ 9 · la herramienta MCP: una llave, la variable ═══════════════════════════════
// 24-nov-2026: Nicholas decidió encenderla en producción («Encender en producción»). Antes
// hacían falta dos llaves (variable del preview Y *.workers.dev); ahora basta la variable,
// que está en producción y en el preview. Sin ella, ni se lista ni se ejecuta.
console.log("\n9 · descubrir_proveedores: la variable RQT_PROVEEDORES la enciende, en cualquier host");
{
  const conf = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, ""));
  si(conf.vars?.RQT_PROVEEDORES === "1" && conf.env?.preview?.vars?.RQT_PROVEEDORES === "1", "RQT_PROVEEDORES en producción y en el preview");
  const api = await import("../api.js");
  const m = (env, u) => api.proveedoresHabilitado(env, new URL(u));
  const PROD = "https://rosettaquantum.com/mcp", PREV = "https://rosetta-quantum-preview.x.workers.dev/mcp", ON = { RQT_PROVEEDORES: "1" };
  si([m(ON, PROD), m({}, PROD), m(ON, PREV), m({ RQT_PROVEEDORES: "0" }, PREV)].join() === "true,false,true,false", "la variable es la llave: con ella sí, sin ella o en «0» no");
  si(!api.herramientasPara({}, new URL(PROD)).some((h) => h.name === "descubrir_proveedores"), "silencio: sin la variable no se lista");
  si(api.herramientasPara(ON, new URL(PROD)).some((h) => h.name === "descubrir_proveedores"), "grito: con la variable se lista en producción");
}

console.log(`\n  --- pasaron ${pasaron} · fallaron ${fallaron}`);
process.exit(fallaron ? 1 : 0);
