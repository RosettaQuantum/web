#!/usr/bin/env node
/**
 * DNS pasivo de la medición (25-nov-2026, decisión del dueño «(a) y (c)»): SPF, DNSSEC, CAA y el CNAME de los
 * nombres del registro CT. Con las respuestas DNS REALES grabadas el 25-nov (scripts/fixtures/medicion-agentes/
 * dns-tenpo.cl.json y dns-bancomuestra.cl.json (un banco chileno grande; el nombre se cambió por «bancomuestra»)) y casos de grito y de silencio.
 *  · tenpo.cl: SPF permerror (se incluye a sí mismo), sin DS, sin CAA, abona.tenpo.cl → rechargetenpodev.azureedge.net.
 *  · bancomuestra.cl: SPF válido, con DS y con CAA; ningún ambiente tras un CNAME; 147 de 227 nombres sin leer por el
 *    tope (declarado en la ficha).
 *  · PRECISIÓN: «developers», «devolucion», «devices», «contest», «testimonios» no son marcadores (token, no substring).
 *    boleta.tenpo.cl → tenpodevboleta.azureedge.net NO se marca: «devboleta» no es el token «dev» (precisión
 *    sobre cobertura, declarado).
 *  · No mueve nada: la letra y el QEX de la ficha de tenpo.cl son los mismos con y sin el DNS pasivo.
 *  · Tope de tiempo: con un reloj que avanza, se corta y cuenta lo que quedó sin leer.
 *  · MUTACIONES: sin partir por el nombre de la organización → abona se pierde; substring → «developers» grita.
 *   node scripts/check-dns-pasivo.mjs
 */
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
registerHooks({ resolve: (esp, ctx, sig) => esp === "cloudflare:sockets"
  ? { url: "data:text/javascript,export function connect(){throw new Error('sin sockets en el guardia')}", shortCircuit: true } : sig(esp, ctx) });
const D = await import("../lib/dns-pasivo.mjs");
const N = await import("../public/js/qex-nucleo.mjs");
const Fi = await import("../public/js/ficha.mjs");
const { conMutante } = await import("./lib/mutar.mjs");

export const CONSUMIDOR = { quien: "sesión web de Rosetta", hace: "no despliega la medición si el DNS pasivo vuelve a marcar substrings o mueve la letra" };

const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
const FX = "scripts/fixtures/medicion-agentes/";
const fallas = [];
let casos = 0;
const igual = (a, b, q) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const grabado = (dom) => { const g = JSON.parse(leer(FX + `dns-${dom}.json`)); return { g, q: async (n, t) => { const k = `${n}|${t}`; if (!(k in g.respuestas)) throw new Error("sin grabar " + k); return g.respuestas[k]; } }; };
const fijo = (mapa) => async (n, t) => (mapa[`${n}|${t}`] || []).map((x) => (typeof x === "string" ? { type: t === "CNAME" ? 5 : 16, data: t === "TXT" ? `"${x}"` : x } : x));

// ---------------------------------------------------------------- tenpo.cl (defecto real)
{
  const { g, q } = grabado("tenpo.cl");
  const r = await D.dnsPasivo("tenpo.cl", g.nombres, q);
  igual([r.spf.valido, r.spf.problema, r.dnssec.ds, r.caa.publicado], [false, "incluye_a_si_mismo", false, false], "tenpo.cl: SPF se incluye a sí mismo (permerror), sin DS, sin CAA");
  igual([r.cname_ct.hallazgos, r.cname_ct.sin_leer], [[{ host: "abona.tenpo.cl", cname: "rechargetenpodev.azureedge.net", marcador: "dev" }], 0], "tenpo.cl: abona → rechargetenpodev (dev), todos leídos");
  igual(g.respuestas["boleta.tenpo.cl|CNAME"]?.[0]?.data, "tenpodevboleta.azureedge.net.", "boleta.tenpo.cl → tenpodevboleta (grabado)…");
  igual(r.cname_ct.hallazgos.some((h) => h.host === "boleta.tenpo.cl"), false, "…y NO se marca: «devboleta» no es el token «dev» (precisión sobre cobertura)");
  // la ficha: alertas INFO y la letra/QEX iguales
  const CT = JSON.parse(gunzipSync(readFileSync(new URL(FX + "ct-tenpo.cl.json.gz", raiz))).toString("utf8"));
  const S = JSON.parse(leer(FX + "sondas-tenpo.cl.json"));
  const ref = JSON.parse(leer("public/data/qex-referencia-vigente.json"));
  const foto = async (dp) => N.armarFoto({ dominio: "tenpo.cl", www: "www.tenpo.cl", vertical: "fintech", medido: "2026-11-25T10:22:42Z", ct: await N.ctDesdeServidor(CT, 0),
    sondas: { ...S, ...(dp ? { dns_pasivo: dp } : {}) }, referencia: ref, origen: "guardia" }).foto;
  const con = await foto(r), sin = await foto(null);
  igual([N.explicarNota(con).nota, con.qex.score], [N.explicarNota(sin).nota, sin.qex.score], "el DNS pasivo no mueve la letra ni el QEX (B, 71)");
  const fi = Fi.armarFicha(con, {}), md = Fi.markdownDe(fi);
  igual(fi.alertas.filter((a) => a.nivel === "INFO").map((a) => [a.codigo, a.donde]),
    [["nombre_interno_ip_publica", "internal-vpn.tenpo.cl"], ["spf_invalido", "tenpo.cl"], ["sin_dnssec", "tenpo.cl"], ["sin_caa", "tenpo.cl"], ["ambiente_tras_cname", "abona.tenpo.cl"]],
    "tenpo.cl: cinco alertas INFO en la ficha");
  igual([md.includes("SPF inválido: el registro se incluye a sí mismo."), Fi.validarMarkdown(md)], [true, []], "la ficha lo dice y sigue válida");
}
// ---------------------------------------------------------------- bancomuestra.cl (silencio + tope)
{
  const { g, q } = grabado("bancomuestra.cl");
  const r = await D.dnsPasivo("bancomuestra.cl", g.nombres, q);
  igual([r.spf.valido, r.dnssec.ds, r.caa.publicado, r.cname_ct.hallazgos.length], [true, true, true, 0], "SILENCIO bancomuestra.cl: SPF válido, con DS, con CAA, sin ambientes tras CNAME");
  igual([r.cname_ct.candidatos, r.cname_ct.leidos, r.cname_ct.sin_leer], [227, D.CNAME_MAX, 227 - D.CNAME_MAX], "bancomuestra.cl: el tope de nombres se respeta y se cuenta lo que quedó sin leer");
  const nm = [];
  igual(Fi.alertasDns(r, (await import("../public/js/qready-textos.mjs")).textosFicha("es")).length, 0, "bancomuestra.cl: ninguna alerta DNS");
  void nm;
}
// ---------------------------------------------------------------- precisión: token, no substring
{
  const neg = ["developers.acme.cl", "devolucion.acme.cl", "devices.acme.cl", "contest.acme.cl", "testimonios.acme.cl", "uatm.acme.cl", "qatar.acme.cl"];
  const mapa = Object.fromEntries(neg.map((n) => [`${n}|CNAME`, [`${n.split(".")[0]}.azurewebsites.net`]]));
  Object.assign(mapa, { "a.acme.cl|CNAME": ["app-dev.azurewebsites.net"], "b.acme.cl|CNAME": ["x-qa-2.cloudfront.net"], "c.acme.cl|CNAME": ["acmestaging.azureedge.net"],
    "d.acme.cl|CNAME": ["prod.dev.example.com"], "e.acme.cl|CNAME": ["test.acme.cl.edgekey.net"] });
  const r = await D.cnameDeNombres([...neg, "a.acme.cl", "b.acme.cl", "c.acme.cl", "d.acme.cl", "e.acme.cl", "api-dev.acme.cl"], "acme.cl", fijo(mapa));
  igual(r.hallazgos.map((h) => [h.host, h.marcador]), [["a.acme.cl", "dev"], ["b.acme.cl", "qa"], ["c.acme.cl", "staging"], ["d.acme.cl", "dev"], ["e.acme.cl", "test"]],
    "GRITO: app-dev, x-qa-2, acme·staging (nombre de la organización), prod.dev, test.x → marcan; SILENCIO: developers, devolucion, devices, contest, testimonios, uatm, qatar no");
  igual(r.candidatos, 12, "api-dev.acme.cl no se lee: su propio nombre ya delata el ambiente (lo cuenta RQ.S.03.2)");
  igual(D.marcadorEn(["web.test.com"], "acme"), null, "las dos últimas etiquetas (el proveedor) no se leen como ambiente");
}
// ---------------------------------------------------------------- tope de tiempo
{
  let t = 0; const reloj = () => (t += 1000);
  const nombres = Array.from({ length: 40 }, (_, i) => `n${i}.x.cl`);
  const r = await D.cnameDeNombres(nombres, "x.cl", fijo({}), { ms: 2500, tanda: 10, ahora: reloj });
  igual([r.leidos < 40, r.leidos + r.sin_leer], [true, 40], "con el reloj agotado se corta y declara cuántos quedaron sin leer");
}
// ---------------------------------------------------------------- SPF: los demás permerror
{
  const s = async (m) => D.spf("x.cl", fijo(m));
  igual((await s({ "x.cl|TXT": ["v=spf1 include:_spf.google.com ~all"], "_spf.google.com|TXT": ["v=spf1 ip4:1.2.3.4 ~all"] })).valido, true, "SILENCIO: un include sano es válido");
  igual((await s({ "x.cl|TXT": ["v=spf1 -all", "v=spf1 mx -all"] })).problema, "varios_registros", "dos registros v=spf1 → permerror");
  const once = Array.from({ length: 11 }, (_, i) => `a:h${i}.x.cl`).join(" ");
  igual((await s({ "x.cl|TXT": [`v=spf1 ${once} -all`] })).problema, "mas_de_10_consultas", "11 mecanismos que consultan DNS → permerror");
  igual((await s({ "x.cl|TXT": ["v=spf1 include:nada.x.cl -all"] })).problema, "include_sin_spf", "include a un dominio sin SPF → permerror");
  igual((await s({ "x.cl|TXT": ["v=spf1 include:y.cl -all"], "y.cl|TXT": ["v=spf1 include:x.cl -all"] })).problema, "incluye_a_si_mismo", "bucle de vuelta al dominio → permerror");
  igual((await s({ "x.cl|TXT": ["google-site-verification=abc"] })).problema, "sin_spf", "sin SPF: no medido como inválido (no alerta)");
}
// ---------------------------------------------------------------- mutaciones
const { g: gt } = grabado("tenpo.cl");
await conMutante(new URL("lib/dns-pasivo.mjs", raiz), "  if (org && org.length >= 3) s = s.split(org).join(\".\");\n", "",
  async (M) => igual((await M.cnameDeNombres(gt.nombres, "tenpo.cl", grabado("tenpo.cl").q)).hallazgos.length, 0, "MUTACIÓN: sin partir por el nombre de la organización, abona se pierde (el grito lo ve)"));
await conMutante(new URL("lib/dns-pasivo.mjs", raiz), "const t = tokens(l, org).find((x) => MARCADORES.includes(x));", "const t = MARCADORES.find((x) => l.includes(x));",
  async (M) => igual(M.marcadorEn(["developers.azurewebsites.net"], "x") != null, true, "MUTACIÓN: substring en vez de token → «developers» marca (el silencio lo ve)"));

if (fallas.length) { for (const f of fallas) console.error("  ✗ " + f); console.error(`check-dns-pasivo: ${fallas.length} FALLA(S) de ${casos} casos`); process.exit(1); }
console.log(`check-dns-pasivo: ok (${casos} casos · tenpo.cl y bancomuestra.cl grabados · SPF/DNSSEC/CAA/CNAME · token y no substring · tope de tiempo · no mueve la letra · 2 mutaciones)`);
