#!/usr/bin/env node
/**
 * La auditoría de tenpo.cl (claude.nico, 25-nov-2026) como caso de prueba: cada falencia de la MEDICIÓN que se
 * reprodujo en producción el 25-nov, con las respuestas REALES grabadas ese día (scripts/fixtures/medicion-agentes/
 * ct-tenpo.cl.json.gz, sondas-tenpo.cl.json, correo-tenpo.cl.json), por el camino real de medirParaAgente (MCP y
 * /v1/medicion; la página arma la misma ficha con ficha.mjs). Lo que decía producción va al lado de cada caso.
 *   1  nombres: «t•••#18.tenpo.cl» → test.tenpo.cl; ni una máscara (decisión «Dejar de enmascarar»).
 *   4  HNDL: «mediana_pais: 12» contra un modelo de 65 → null; la ficha agrega el QEX sin el modelo (73) y el
 *      publicado sigue en 71.
 *   5  «B con 71» y «H1 → A»: la ficha dice que la letra no sale del QEX, que A1-A4 ponen techo B y que A5 no
 *      impide la A por sí sola. Que sea cierto: quitar A1-A4 (H1) da A, con el mismo QEX.
 *   6  CT: la evidencia nombra cada fuente del registro, si es copia y de qué fecha.
 *   7  internal-vpn.tenpo.cl → 20.7.190.100 (pública): alerta INFO, que no mueve la letra.
 *   8  www.tenpo.cl → cdn.webflow.com, AS209242: «otro» → Cloudflare (catálogo único, proveedorAsn).
 *   11 «TLS 1.3 … | 0» → «cumple · descuento 0»; la evidencia explica por qué el certificado se leyó con TLS 1.2.
 *   12 RQ.S.05.2/05.3 vacíos con elige_hibrido_pq: true → «sí».
 *   13 A_como_navegador: la respuesta dice qué hace cada saludo (no imita a un navegador; por eso hrr: true).
 *   14 «11 nombres no productivos» dice que es el historial del registro; «4/12 responden» dice que no descuenta.
 *   17 mx_omitidos: 3 → cuáles y por qué (el tope de la sonda, que debe ser el mismo en Python).
 *   node scripts/check-medicion-tenpo.mjs
 */
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
registerHooks({ resolve: (esp, ctx, sig) => esp === "cloudflare:sockets"
  ? { url: "data:text/javascript,export function connect(){throw new Error('sin sockets en el guardia')}", shortCircuit: true } : sig(esp, ctx) });
const A = await import("../lib/medicion-agentes.mjs");
const N = await import("../public/js/qex-nucleo.mjs");
const Fi = await import("../public/js/ficha.mjs");
const B = await import("../lib/borde-envivo.mjs");
const { conMutante } = await import("./lib/mutar.mjs");

export const CONSUMIDOR = { quien: "sesión web de Rosetta", hace: "no despliega la medición si vuelve una falencia de la auditoría de tenpo.cl" };

const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
const FX = "scripts/fixtures/medicion-agentes/";
const CT = JSON.parse(gunzipSync(readFileSync(new URL(FX + "ct-tenpo.cl.json.gz", raiz))).toString("utf8"));
const SONDAS = JSON.parse(leer(FX + "sondas-tenpo.cl.json"));
const CORREO = JSON.parse(leer(FX + "correo-tenpo.cl.json"));
const fallas = [];
let casos = 0;
const igual = (a, b, q) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const silenciar = () => { const o = [console.error, console.log]; console.error = () => {}; console.log = () => {}; return () => { [console.error, console.log] = o; }; };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const M = { ct: async () => json(CT), sondas: async () => json(SONDAS),
  correo: async (req) => (req.method === "POST" ? json({ ok: true, id: "c0ffee", reusada: true }) : json(CORREO)) };
const dbNula = { prepare: () => ({ bind: () => ({ first: async () => null, all: async () => ({ results: [] }) }), first: async () => null }) };
async function medir(Mod = A) {
  const restaurar = silenciar();
  try { return (await Mod.medirParaAgente({ DB: dbNula }, { dominio: "tenpo.cl", sector: "fintech" }, { canal: "mcp", ip: "203.0.113.12" }, null, M)).cuerpo; }
  finally { restaurar(); }
}
const r = await medir();
const md = r.presentacion?.markdown || "", ficha = r.presentacion?.ficha || {};
const fila = (id) => md.split("\n").find((l) => l.startsWith(`| ${id} |`)) || "";

// 1 · nombres completos
igual([JSON.stringify(r).includes(Fi.MASCARA), r.nombres_enmascarados, md.includes("| test.tenpo.cl |"), /#[0-9a-f]{2}\.tenpo\.cl/.test(md)], [false, false, true, false],
  "1 · tenpo.cl decía «t•••#18.tenpo.cl»: ahora test.tenpo.cl, sin máscaras ni sufijos");
// 4 · HNDL
const sinModelo = N.irec({ ...r.qex.dimensiones && Object.fromEntries(Object.entries(r.qex.dimensiones).map(([k, v]) => [k, v.valor])), hndl: null });
igual([r.qex.valor, r.qex.dimensiones.hndl.mediana_pais, sinModelo], [71, null, 73], "4 · QEX publicado 71; mediana_pais de HNDL null (decía 12); sin el modelo, 73");
igual(md.includes("QEX sin el modelo HNDL del sector (sólo lo medido): 73. El índice publicado sigue siendo 71."), true, "4 · la ficha muestra el QEX sin el modelo");
// 5 · la letra y el QEX
const como = ficha.veredicto?.como_letra || "";
igual([r.nota.letra, /A1-A4 ponen techo B/.test(como), /A5, por sí sola, no impide la A/.test(como)], ["B", true, true], "5 · B con 71: la ficha dice que A1-A4 ponen techo B y A5 no impide la A");
{ // ¿es cierto? sin los ambientes de prueba (lo que hace H1), la nota es A con el mismo QEX
  const foto = N.armarFoto({ dominio: "tenpo.cl", www: "www.tenpo.cl", vertical: "fintech", medido: "2026-11-25T10:22:42Z", ct: await N.ctDesdeServidor(CT, 0),
    // H1 «retirar de internet»: los cuatro nombres dejan de existir en DNS (así lo simula Fi.analizar)
    sondas: { ...SONDAS, endpoints: SONDAS.endpoints.map((e) => (e.responde_443 && N.clasesDe(e.host).includes("no_productivo")
      ? { ...e, dns_status: "NXDOMAIN", ip: [], cname: [], responde_443: null, hibrido: null, detalle: "retirado (simulado)" } : e)) },
    referencia: JSON.parse(leer("public/data/qex-referencia-vigente.json")), origen: "guardia" }).foto;
  igual([N.explicarNota(foto).nota, foto.qex.score], ["A", 71], "5 · cierto en el código: sin A1-A4, A con el mismo QEX 71 (H1 → A no mueve el QEX)");
}
// 6 · CT: fuente y fecha
igual(/^- Registro CT: crt\.sh, copia del 2026-11-25 \d\d:\d\d UTC \(\d+ cert\.\) · Cert Spotter.*, copia del 2026-11-25 \d\d:\d\d UTC \(\d+ cert\.\)$/m.test(md), true,
  "6 · la evidencia nombra cada fuente del registro, si es copia y de qué fecha");
// 7 · nombre interno con IP pública
const info = ficha.alertas.filter((a) => a.nivel === "INFO");
igual(info.map((a) => [a.codigo, a.donde, a.hallazgo.includes("20.7.190.100")]), [["nombre_interno_ip_publica", "internal-vpn.tenpo.cl", true]], "7 · internal-vpn.tenpo.cl → IP pública: alerta INFO");
igual(Fi.internosPublicos([{ host: "internacional.x.cl", dns_status: "NOERROR", ip: ["1.2.3.4"] }, { host: "internal.x.cl", dns_status: "NOERROR", ip: ["10.1.2.3"] }]).length, 0,
  "7 · SILENCIO: «internacional» no es interno; un interno con IP privada no alerta");
// 8 · CDN por ASN
{
  const orig = globalThis.fetch;
  globalThis.fetch = async (u) => {
    const q = new URL(u), n = q.searchParams.get("name"), t = q.searchParams.get("type");
    const A_ = t === "CNAME" && n === "www.tenpo.cl" ? [{ type: 5, data: "cdn.webflow.com." }]
      : t === "A" && n === "cdn.webflow.com" ? [{ type: 1, data: "198.202.211.1" }]
      : t === "TXT" && n === "1.211.202.198.origin.asn.cymru.com" ? [{ type: 16, data: "\"209242 | 198.202.211.0/24 | US | arin | 2021-08-11\"" }] : [];
    return json({ Status: 0, Answer: A_ });
  };
  try { igual(await B.cadenaCname("www.tenpo.cl"), { cadena: ["cdn.webflow.com"], cdn: "Cloudflare", asn: 209242 }, "8 · www.tenpo.cl decía «otro»: AS209242 → Cloudflare (catálogo único)"); }
  finally { globalThis.fetch = orig; }
  igual(SONDAS.borde.dns.cdn, "otro", "8 · el defecto real quedó grabado («otro» en la respuesta del 25-nov)");
}
// 11 · TLS 1.3 y el certificado
igual([/cumple · descuento 0/.test(fila("RQ.S.03.1")), /^- Certificado: saludo TLS 1\.2.*\(en TLS 1\.3 el certificado viaja cifrado; con un saludo TLS 1\.2 se lee sin completar una sesión\)$/m.test(md)], [true, true],
  "11 · «TLS 1.3 | 0» → «cumple · descuento 0», y por qué el certificado se leyó con TLS 1.2");
// 12 · informativos con valor
igual([r.sitio_web.elige_hibrido_pq, /\| sí \|/.test(fila("RQ.S.05.2")), /\| (sí|no) \|/.test(fila("RQ.S.05.3"))], [true, true, true], "12 · RQ.S.05.2/05.3 ya no salen vacíos");
// 13 · qué es cada saludo
igual([r.sitio_web.saludos.A_como_navegador.hrr, /HelloRetryRequest/.test(r.sitio_web.que_es_cada_saludo?.A_como_navegador || "")], [true, true], "13 · hrr: true, y la respuesta dice por qué (no imita a un navegador)");
// 14 · qué descuenta
igual([/11 nombres no productivos en el historial del registro CT/.test(fila("RQ.S.03.2")), /4\/12 sensibles responden hoy \(no descuenta del QEX; ver alertas\)/.test(fila("RQ.S.09"))], [true, true],
  "14 · se entiende qué descuenta: el historial (−10) sí; los que responden hoy, no (van a las alertas)");
// 17 · MX omitidos
igual(Fi.mxOmitidos(CORREO.resultado), ["alt3.aspmx.l.google.com", "alt4.aspmx.l.google.com", "aspmx.l.google.com"], "17 · mx_omitidos: 3 → cuáles");
igual(md.includes("3 de los 7 servidores de correo no se midieron (alt3.aspmx.l.google.com, alt4.aspmx.l.google.com, aspmx.l.google.com): la sonda mide los 4 primeros de la lista publicada."), true,
  "17 · la ficha dice cuáles y por qué");
igual(Number(/^MAX_MX = (\d+)/m.exec(leer("vps/sonda-correo/sonda_correo.py"))?.[1]), Fi.MAX_MX_CORREO, "17 · el tope que dice la ficha es el de la sonda (MAX_MX en Python)");
igual(Fi.validarMarkdown(md), [], "la ficha de tenpo.cl cumple la sintaxis rosetta-ficha/1");

// mutaciones
await conMutante(new URL("public/js/ficha.mjs", raiz), "const sin_modelo = d.hndl != null && score != null ? { score: N.irec({ ...d, hndl: null }) } : null;", "const sin_modelo = null;",
  async (F2) => igual(F2.arbolQex(N.armarFoto({ dominio: "tenpo.cl", www: "www.tenpo.cl", vertical: "fintech", medido: "2026-11-25T10:22:42Z", ct: await N.ctDesdeServidor(CT, 0),
    sondas: SONDAS, referencia: JSON.parse(leer("public/data/qex-referencia-vigente.json")), origen: "guardia" }).foto).sin_modelo, null, "MUTACIÓN: sin el QEX sin modelo → la línea desaparece (el guardia lo ve si el caso 4 falla)"));
await conMutante(new URL("public/js/ficha.mjs", raiz), "const techo = alertas.filter((a) => N.MEDIAS_CON_TECHO_B.includes(a.codigo)).map((a) => a.id);", "const techo = [];",
  async (F2) => igual(/techo B/.test(F2.comoLetra({ nota: "B" }, [{ id: "A1", nivel: "MEDIA", codigo: "ambiente_pruebas_publicado" }])), false,
    "MUTACIÓN: sin las alertas de techo, la explicación ya no nombra el techo B (el guardia lo ve en el caso 5)"));

if (fallas.length) { for (const f of fallas) console.error("  ✗ " + f); console.error(`check-medicion-tenpo: ${fallas.length} FALLA(S) de ${casos} casos`); process.exit(1); }
console.log(`check-medicion-tenpo: ok (${casos} casos · tenpo.cl grabado el 25-nov: falencias 1, 4, 5, 6, 7, 8, 11, 12, 13, 14 y 17 con el defecto real · 2 mutaciones)`);
