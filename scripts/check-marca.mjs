/**
 * T-marca — el dibujo cabe dentro de su propio viewBox.
 *
 * EL DEFECTO (DEF-06, medido el 8-sep sobre el asset servido)
 * ----------------------------------------------------------
 * Nicholas vio la hoja CORTADA arriba en un iPhone. Cowork midio despues y no lo
 * reprodujo: la <img> media 36 px, entera, dentro del nav, con overflow visible. Las dos
 * cosas eran ciertas — porque el recorte NO estaba en la maquetacion, estaba DENTRO del
 * SVG. Medir la caja de la imagen no puede encontrarlo: la caja esta perfecta y lo que
 * falta es el dibujo.
 *
 * Lo medido: con viewBox "0 0 34 36", la tinta iba de y=-5,70 a y=37,05. O sea 5,70
 * unidades fuera por arriba (13% del alto del dibujo) y 1,05 por abajo. Una <img> de SVG
 * recorta a su viewport, asi que la punta de la hoja se servia cortada plana — en todos
 * los navegadores y en todos los tamaños desde el 27-ago. A 34 px son ~2 px: se ve en una
 * pantalla de 3x y se pierde en una captura de escritorio.
 *
 * El mismo viewBox viene en los tres archivos originales del creador (handoff/web/
 * rosetta-mark-C1*.svg): el recorte es del asset, no lo introdujimos nosotros.
 *
 * QUE MIDE ESTE GUARDIA, Y POR QUE ASI
 * ------------------------------------
 * Calcula la caja EXACTA del trazo —parsea el path, aplica la transformacion del grupo y
 * resuelve los extremos de cada bezier— y la compara con el viewBox. No mira pixeles ni
 * la caja de la imagen: mira el objeto. Un guardia que comprobara "el SVG responde 200 y
 * es teal" habria estado verde todo este tiempo.
 *
 * PUNTO CIEGO DECLARADO: comprueba que quepa, no que se vea BIEN. Si el creador manda una
 * marca nueva, este guardia dira si esta recortada; si esta bien compuesta lo dice
 * Nicholas.
 */
import { readFileSync } from "node:fs";

export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild",
  hace: "no sigue: el logotipo se sirve recortado en todo el sitio y la caja de la imagen se mide perfecta",
};

const ARCHIVOS = ["public/rosetta-mark.svg", "public/favicon.svg"];
const HOLGURA_MIN = 0.2;   // unidades de usuario. Cero seria "justo al borde", que es fragil.

// ── matrices afines [a,b,c,d,e,f] : x' = a·x + c·y + e ; y' = b·x + d·y + f ──────
const I = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const aplica = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

function parseaTransform(t) {
  let m = I;
  for (const g of (t || "").matchAll(/([a-zA-Z]+)\s*\(([^)]*)\)/g)) {
    const n = g[2].trim().split(/[\s,]+/).map(Number);
    if (g[1] === "translate") m = mul(m, [1, 0, 0, 1, n[0], n[1] || 0]);
    else if (g[1] === "scale") m = mul(m, [n[0], 0, 0, n.length > 1 ? n[1] : n[0], 0, 0]);
    else if (g[1] === "rotate") {
      const a = (n[0] * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
      const r = [c, s, -s, c, 0, 0];
      m = n.length > 1 ? mul(mul(mul(m, [1, 0, 0, 1, n[1], n[2]]), r), [1, 0, 0, 1, -n[1], -n[2]]) : mul(m, r);
    } else if (g[1] === "matrix") m = mul(m, n);
    else throw new Error(`transformacion no soportada: ${g[1]} — este guardia mediria de menos`);
  }
  return m;
}

// Extremos exactos de una bezier cubica en un eje: los ceros de la derivada, mas los topes.
function extremos(p0, p1, p2, p3) {
  const vals = [p0, p3];
  // La derivada de la cubica, en forma estandar qa·t² + qb·t + qc.
  const qa = 3 * (-p0 + 3 * p1 - 3 * p2 + p3);
  const qb = 6 * (p0 - 2 * p1 + p2);
  const qc = 3 * (p1 - p0);
  const raices = [];
  if (Math.abs(qa) < 1e-12) { if (Math.abs(qb) > 1e-12) raices.push(-qc / qb); }
  else { const d = qb * qb - 4 * qa * qc; if (d >= 0) { const r = Math.sqrt(d); raices.push((-qb + r) / (2 * qa), (-qb - r) / (2 * qa)); } }
  for (const t of raices) if (t > 0 && t < 1) {
    const u = 1 - t;
    vals.push(u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3);
  }
  return vals;
}

function cajaDelTrazo(d, m) {
  const tok = d.match(/[MLCZmlcz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  let i = 0, cur = [0, 0], ini = [0, 0];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const ver = (p) => { const q = aplica(m, p); x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); };
  const num = () => Number(tok[i++]);
  let cmd = null;
  while (i < tok.length) {
    if (/[MLCZmlcz]/.test(tok[i])) cmd = tok[i++];
    if (cmd === "M" || cmd === "L") { const p = [num(), num()]; if (cmd === "M") ini = p; cur = p; ver(p); if (cmd === "M") cmd = "L"; }
    else if (cmd === "C") {
      const c1 = [num(), num()], c2 = [num(), num()], p = [num(), num()];
      // la transformacion es afin: transformar los puntos de control y luego acotar es exacto
      const [P0, P1, P2, P3] = [cur, c1, c2, p].map((q) => aplica(m, q));
      for (const v of extremos(P0[0], P1[0], P2[0], P3[0])) { x0 = Math.min(x0, v); x1 = Math.max(x1, v); }
      for (const v of extremos(P0[1], P1[1], P2[1], P3[1])) { y0 = Math.min(y0, v); y1 = Math.max(y1, v); }
      cur = p;
    } else if (cmd === "Z" || cmd === "z") { cur = ini; }
    else if (cmd === null) i++;
    else throw new Error(`comando de path no soportado: ${cmd}`);
  }
  return { x0, y0, x1, y1 };
}

function mide(archivo, texto) {
  const vb = (texto.match(/viewBox="([^"]+)"/) || [])[1];
  if (!vb) return { error: "sin viewBox" };
  const [vx, vy, vw, vh] = vb.trim().split(/[\s,]+/).map(Number);
  const m = parseaTransform((texto.match(/<g[^>]*transform="([^"]+)"/) || [])[1]);
  let caja = null;
  for (const p of texto.matchAll(/<path[^>]*\sd="([^"]+)"/g)) {
    const c = cajaDelTrazo(p[1], m);
    caja = caja ? { x0: Math.min(caja.x0, c.x0), y0: Math.min(caja.y0, c.y0), x1: Math.max(caja.x1, c.x1), y1: Math.max(caja.y1, c.y1) } : c;
  }
  if (!caja) return { error: "sin <path>" };
  const r = (n) => +n.toFixed(2);
  return { vb, caja: { x0: r(caja.x0), y0: r(caja.y0), x1: r(caja.x1), y1: r(caja.y1) },
    sobra: { izq: r(caja.x0 - vx), arriba: r(caja.y0 - vy), der: r(vx + vw - caja.x1), abajo: r(vy + vh - caja.y1) } };
}

const fallos = [];
for (const f of ARCHIVOS) {
  const m = mide(f, readFileSync(f, "utf8"));
  if (m.error) { console.log(`  FALLA ${f} — ${m.error}`); fallos.push(f); continue; }
  const cortes = Object.entries(m.sobra).filter(([, v]) => v < HOLGURA_MIN);
  if (cortes.length) {
    console.log(`  FALLA ${f} · viewBox "${m.vb}" · trazo x ${m.caja.x0}..${m.caja.x1} y ${m.caja.y0}..${m.caja.y1}`);
    cortes.forEach(([lado, v]) => console.log(`        ${lado}: ${v} — el dibujo se sale ${(-v).toFixed(2)} unidades, y una <img> de SVG recorta a su viewport`));
    fallos.push(f);
  } else {
    console.log(`  ok    ${f.padEnd(26)} viewBox "${m.vb}" · holgura ${Object.entries(m.sobra).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  }
}

// GRITO: con el viewBox que se servia hasta hoy, este guardia tiene que ponerse rojo.
// Es el defecto real, no uno inventado — por eso la prueba usa exactamente ese valor.
{
  const roto = readFileSync(ARCHIVOS[0], "utf8").replace(/viewBox="[^"]+"/, 'viewBox="0 0 34 36"');
  const m = mide("mutacion", roto);
  if (m.sobra.arriba >= HOLGURA_MIN) { console.log(`  FALLA el viewBox viejo (0 0 34 36) no dispara: arriba ${m.sobra.arriba}`); fallos.push("grito"); }
  else console.log(`  ok    grito                      con el viewBox viejo mide ${m.sobra.arriba} arriba — cortado, como estaba`);
}

if (fallos.length) { console.log(`\nT-marca: ${fallos.length} archivo(s) con el dibujo fuera de su ventana.`); process.exit(1); }
console.log("\nT-marca: el trazo cabe entero dentro de su viewBox en los dos archivos.");
