#!/usr/bin/env node
/**
 * Subíndices QEX v1 (17-nov-2026, spec entregables/ficha-rosetta-2026-11/QEX-subindices-v1.md, aprobada
 * por el dueño): el árbol de puntos de la sección 02 SUMA. Si no suma, el build se detiene.
 *
 * POR QUÉ EXISTE. El árbol abre la aritmética que ya corre en qex-nucleo.mjs. El modo de fallo es un árbol
 * que se ve bien y no reproduce el número: un −10 de más, una base 75, un umbral «más de 3» en vez de «3 o
 * más». Cada uno da una tabla plausible al lado de un QEX que no sale de ella.
 *
 *  1. Sobre las 5 fotos fijas (scripts/fixtures/ficha/): base + subíndices = la dimensión de la foto, la
 *     suma de los aportes = la suma del QEX, irec = el QEX, y RQ.S.04 = el valor del sector en la
 *     referencia PUBLICADA (public/data/qex-referencia-2026-08.json). Cada subíndice declara QEX-1.0.
 *  2. El ejemplo trabajado de la spec, con la respuesta real de yu-track.com del 16-nov (rastreo.json,
 *     dominio enmascarado): 61,25 → 61; máximo alcanzable 83,75 → 84.
 *  3. Las reglas una por una, con fotos derivadas: sin TLS 1.3 −30; infraestructura 3 resta y 2 no
 *     (el umbral); sin registro no descuenta; RQ.S.06 no entra.
 *  4. MUTACIONES: base 75, umbral «más de 3», aportes inflados → grita.
 *  5. Con --corpus <carpeta del proyecto>: las 170 filas del índice de agosto (privado, no está en el repo)
 *     se escriben con el árbol: certificados 75/100, borde 0/100, higiene = 70 − 30a − 10b, HNDL = el del
 *     sector, e irec reproduce el score. Sin --corpus esas pruebas salen SALTADAS en el resumen.
 *   node scripts/check-qex-subindices.mjs [--corpus <carpeta>]
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
const Fi = await import("../public/js/ficha.mjs");
const N = await import("../public/js/qex-nucleo.mjs");
const { conMutante } = await import("./lib/mutar.mjs");

export const CONSUMIDOR = { quien: "sesion web de Rosetta, y el informe mensual que importa arbolQex", hace: "corrige arbolQex en public/js/ficha.mjs hasta que el árbol reproduzca la dimensión y el QEX, antes de desplegar; nunca publica un desglose que no suma" };

const fallas = [];
let casos = 0, saltados = 0;
const igual = (a, b, q) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
const clon = (x) => JSON.parse(JSON.stringify(x));
const REF = JSON.parse(leer("public/data/qex-referencia-2026-08.json"));
const fixture = (c) => JSON.parse(leer(`scripts/fixtures/ficha/${c}.json`));
const r2 = (v) => Math.round(v * 100) / 100;

// Lo que tiene que cumplir cualquier árbol: suma por dimensión, suma de aportes y QEX.
function revisar(A, foto, q, nombre) {
  const d = foto.qex.dimensiones;
  for (const D of Object.values(A.dimensiones)) {
    const recompuesta = D.base != null ? D.base + D.subindices.reduce((t, s) => t + (s.dimension || 0), 0)
      : D.modelo ? D.valor : D.subindices.filter((s) => !s.informativo).reduce((t, s) => (s.dimension == null ? t : (t ?? 0) + s.dimension), null);
    igual([recompuesta, D.valor], [d[D.clave], d[D.clave]], `${q}: ${nombre} ${D.clave}: base + subíndices = la dimensión de la foto`);
  }
  const aportes = Object.values(A.dimensiones).reduce((t, D) => t + (D.aporte || 0), 0);
  igual([r2(aportes), A.score], [foto.qex.suma, foto.qex.score], `${q}: ${nombre}: la suma de los aportes = la suma del QEX, e irec = el QEX`);
}

// ---------------------------------------------------------------- 1 · las fotos fijas
for (const c of ["a", "f", "sin-correo", "rastreo", "rastreob"]) {
  const { foto, ctx } = fixture(c);
  const A = Fi.arbolQex(foto);
  igual(A.cuadra, true, `${c}: el árbol cuadra`);
  revisar(A, foto, "foto fija", c);
  igual(A.dimensiones["RQ.S.04"].valor, REF.verticales[foto.vertical].hndl, `${c}: RQ.S.04 = el HNDL del sector en la referencia publicada`);
  const subs = Object.values(A.dimensiones).flatMap((D) => D.subindices);
  igual([...new Set(subs.map((s) => s.metodo))], ["QEX-1.0"], `${c}: cada subíndice declara su método (QEX-1.0)`);
  igual(Object.keys(A.dimensiones), ["RQ.S.02", "RQ.S.03", "RQ.S.04", "RQ.S.05"], `${c}: RQ.S.06 (correo) no entra al QEX`);
  const fi = Fi.armarFicha(foto, ctx);
  igual([fi.puntos_qex === undefined, JSON.stringify(fi.indicadores["RQ.S.03"].subindices) === JSON.stringify(A.dimensiones["RQ.S.03"].subindices), fi.indicadores["RQ.S.03"].texto],
    [false, true, `${foto.qex.dimensiones.higiene}/70`], `${c}: la ficha lleva el MISMO árbol y la higiene sobre 70`);
}

// ---------------------------------------------------------------- 2 · el ejemplo trabajado (yu-track.com, 16-nov, enmascarado)
{
  const A = Fi.arbolQex(fixture("rastreo").foto);
  const fila = (id) => Object.values(A.dimensiones).flatMap((D) => D.subindices).find((s) => s.id === id);
  igual([fila("RQ.S.02.1").dimension, fila("RQ.S.02.1").qex, fila("RQ.S.03.2").dimension, fila("RQ.S.03.2").qex, fila("RQ.S.05.1").dimension],
    [75, 30, -10, -2.5, 0], "ejemplo: RSA-2048 = 75 (30,00 QEX); no productivos −10 (−2,50); no soporta el híbrido 0");
  igual([A.dimensiones["RQ.S.03"].valor, A.dimensiones["RQ.S.03"].aporte, A.dimensiones["RQ.S.04"].aporte, A.suma, A.score, A.maximo],
    [60, 15, 16.25, 61.25, 61, { suma: 83.75, score: 84 }], "ejemplo: higiene 60 (15,00), HNDL 65 (16,25), 61,25 → 61, máximo 83,75 → 84");
  // la spec lista también «sacar staging +2,5 (sólo en QEX-1.1)»: no se imprime. En 1.0 no da puntos y la
  // ficha no nombra la 1.1 (scripts/check-qex-11.mjs). Ver el reporte: es lo que no calzó con la spec.
  // (18-nov-2026) la foto del ejemplo es QEX-1.0: su desglose cuadra con la regla de agosto, pero ya no se le
  // recomienda «llave RSA-4096 o P-384 +10» (NIST IR 8547: una llave clásica más grande no suma). Queda el híbrido.
  igual(A.ganancias, [["acc_hibrido", 10]], "ejemplo (foto QEX-1.0): puntos por acción: sólo el híbrido +10");
  const md = Fi.markdownDe(Fi.armarFicha(fixture("rastreo").foto, fixture("rastreo").ctx));
  igual(["| = RQ.S.01 | suma de los aportes |  | 61,25 → 61 |", "Máximo alcanzable desde afuera: 83,75 → 84."].filter((t) => !md.includes(t)), [], "ejemplo: la ficha lo imprime así");
  // la web, /verificado y el PDF: la misma tabla
  const fi = Fi.armarFicha(fixture("rastreo").foto, fixture("rastreo").ctx);
  for (const [q, h] of [["web", Fi.htmlDe(fi)], ["/verificado (01 y 02)", Fi.htmlDe(fi, { secciones: ["veredicto", "indicadores"] })], ["PDF", Fi.htmlDe(fi, { documento: true })]])
    igual([(h.match(/class="rf-ar-total"/g) || []).length, h.includes("61,25 → 61")], [4, true], `${q}: trae el árbol (4 subtotales y el QEX)`);
}

// ---------------------------------------------------------------- 3 · las reglas, una por una
{
  const base = fixture("rastreo").foto;
  const con = (cambios) => { const f = clon(base); cambios(f); return f; };
  // sin TLS 1.3: −30 (la dimensión de la foto se recalcula con el núcleo, como la armaría armarFoto)
  const conDim = (f) => { f.qex = { ...N.qex({ ...f.qex.dimensiones, higiene: N.higiene(f.tls13 === false ? true : f.tls13 === true ? false : null, f.ct ? f.ct.conteos : null) }), tipos: f.qex.tipos }; return f; };
  const sinTls = conDim(con((f) => { f.tls13 = false; }));
  const A1 = Fi.arbolQex(sinTls);
  igual([A1.cuadra, A1.dimensiones["RQ.S.03"].subindices[0].dimension, A1.dimensiones["RQ.S.03"].valor], [true, -30, 30], "sin TLS 1.3: −30 y la higiene queda en 30");
  revisar(A1, sinTls, "regla", "sin TLS 1.3");
  const infra = (n) => conDim(con((f) => { f.ct.conteos.infra_expuesta = n; }));
  const A3 = Fi.arbolQex(infra(3)), A2 = Fi.arbolQex(infra(2));
  igual([A3.cuadra, A3.dimensiones["RQ.S.03"].subindices[2].dimension, A2.cuadra, A2.dimensiones["RQ.S.03"].subindices[2].dimension], [true, -10, true, 0],
    "infraestructura: 3 nombres restan 10, 2 no (el umbral del núcleo)");
  const sinCt = conDim(con((f) => { f.ct = null; }));
  const AC = Fi.arbolQex(sinCt);
  igual([AC.cuadra, AC.dimensiones["RQ.S.03"].subindices.slice(1, 4).map((s) => [s.dimension, s.tipo])], [true, [[0, "no medido"], [0, "no medido"], [0, "no medido"]]],
    "sin registro de certificados: no descuenta, y se declara no medido");
  // la foto que no cuadra (una dimensión retocada a mano) no pinta el árbol
  const trucha = con((f) => { f.qex.dimensiones.higiene = 65; });
  const fT = Fi.armarFicha(trucha, {});
  igual([fT.puntos_qex.cuadra, Fi.markdownDe(fT).includes("| = RQ.S.03 |"), Fi.markdownDe(fT).includes("no cuadra")], [false, false, true],
    "una foto cuyo número no sale de sus reglas: el árbol no se pinta y se dice");
}

// ---------------------------------------------------------------- 4 · mutaciones
const FICHA = new URL("public/js/ficha.mjs", raiz);
const todasCuadran = (M) => ["a", "f", "sin-correo", "rastreo", "rastreob"].every((c) => M.arbolQex(fixture(c).foto).cuadra);
await conMutante(FICHA, "recompuesto: Math.max(0, Math.min(100, 70 + dT + dN + dI + dL))", "recompuesto: Math.max(0, Math.min(100, 75 + dT + dN + dI + dL))",
  async (M) => igual(todasCuadran(M), false, "MUTACIÓN: base 75 → el árbol no cuadra (el guardia lo ve)"));
await conMutante(FICHA, "dI = ct && (ct.infra_expuesta || 0) >= 3 ? -10 : 0", "dI = ct && (ct.infra_expuesta || 0) > 3 ? -10 : 0",
  async (M) => { const f = clon(fixture("rastreo").foto); f.ct.conteos.infra_expuesta = 3;
    f.qex = { ...N.qex({ ...f.qex.dimensiones, higiene: N.higiene(false, f.ct.conteos) }), tipos: f.qex.tipos };
    igual(M.arbolQex(f).cuadra, false, "MUTACIÓN: umbral «más de 3» → con 3 nombres el árbol no cuadra (el guardia lo ve)"); });
await conMutante(FICHA, "D.aporte = D.valor == null ? null : r2(D.valor * D.peso);", "D.aporte = D.valor == null ? null : r2(D.valor * D.peso * 1.01);",
  async (M) => { const f = fixture("rastreo").foto, A = M.arbolQex(f);
    const s = Object.values(A.dimensiones).reduce((t, D) => t + (D.aporte || 0), 0);
    igual(r2(s) === f.qex.suma, false, "MUTACIÓN: aportes inflados 1 % → la suma de los aportes ya no da el QEX (el guardia lo ve)"); });

// ---------------------------------------------------------------- 5 · la referencia publicada, fila por fila (corpus privado)
const iC = process.argv.indexOf("--corpus");
const corpus = iC > 0 ? process.argv[iC + 1] : null;
const ruta = corpus ? join(corpus, "indice-agosto-2026.json") : null;
if (!ruta || !existsSync(ruta)) { saltados++; console.log("  SALTADO las 170 filas del índice de agosto: pase --corpus <carpeta del proyecto> (el corpus no vive en el repo)"); }
else {
  const filas = JSON.parse(readFileSync(ruta, "utf8"));
  const malas = [];
  for (const r of filas) {
    const h = r.higiene, ok = [r.certificados == null || [75, 100].includes(r.certificados), r.edge == null || [0, 100].includes(r.edge),
      h == null || [0, 1].some((a) => [0, 1, 2, 3].some((b) => 70 - 30 * a - 10 * b === h)), r.hndl === REF.verticales[r.vertical]?.hndl,
      N.irec({ certificados: r.certificados, higiene: r.higiene, hndl: r.hndl, edge: r.edge }) === r.score];
    if (!ok.every(Boolean)) malas.push(r.vertical);
  }
  igual([filas.length, malas.length], [170, 0], "las 170 filas publicadas se escriben con el árbol y reproducen su score");
}

if (fallas.length) { console.error("check-qex-subindices: FALLA\n  " + fallas.join("\n  ")); process.exit(1); }
console.log(`check-qex-subindices: ok (${casos} casos, ${saltados} saltados · 5 fotos fijas + el ejemplo de la spec + reglas una por una · 3 mutaciones gritan)`);
