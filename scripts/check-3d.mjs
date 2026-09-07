/**
 * T-3d — la pieza de /pilots: peso, repintado y carga diferida.
 *
 * QUE VIGILA, Y POR QUE CADA COSA
 * -------------------------------
 *  1. PESO. El spec fija ≤720 KB para el motor. Se cuenta lo que se DESCARGA: los dos
 *     archivos de vendor, three.module.min.js + un OrbitControls. Con la pieza y el motor
 *     de la caminata suman más, y por eso el límite se declara sobre lo que declara el
 *     spec en vez de inventar un número nuevo que cuadre.
 *  2. REPINTADO. La paleta `papel` no puede traer niebla, ni mezcla aditiva, ni bloom:
 *     sobre papel lo aditivo se va a blanco y el punto desaparece justo donde importa.
 *  3. DOS COLORES DISTINTOS. Los residuos fuente (lo medido) y los sitios predichos (lo
 *     afirmado) no pueden compartir color: con el mismo, la pieza estaría afirmando que
 *     la predicción coincide con la verdad — y este experimento midió que no.
 *  4. CARGA DIFERIDA. El HTML de /pilots no puede pedir el motor: 687 KB en la cabecera
 *     castigan a quien entra a leer los precios. Se importa cuando el contenedor llega.
 *
 * PUNTO CIEGO DECLARADO: esto lee archivos y HTML. Que el pulso SE VEA sobre papel, y que
 * la proteína gire a una velocidad que no parezca un salvapantallas, es de mirar la
 * pantalla. Eso lo cierra la revisión con ojos humanos, no este guardia.
 */
import { readFileSync, statSync } from "node:fs";

export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild y quien autoriza el cutover",
  hace: "no publica /pilots: la pagina carga 700 KB de motor a todo el que entra, o la pieza afirma con el color lo contrario de lo que midio",
};

const fallos = [];
const ok = (m) => console.log("  ok    " + m);
const mal = (m) => { console.log("  FALLA " + m); fallos.push(m); };

// 1 · peso del motor descargable
const VENDOR = ["dist/piezas/vendor/three.module.min.js", "dist/piezas/vendor/OrbitControls.home.js"];
const bytes = VENDOR.reduce((n, f) => n + statSync(f).size, 0);
const kb = bytes / 1000;
if (kb > 720) mal(`el motor pesa ${kb.toFixed(1)} KB — el tope del spec es 720 KB`);
else ok(`motor ${kb.toFixed(1)} KB (${VENDOR.length} archivos de vendor) · tope 720 KB`);

// no puede colarse un segundo OrbitControls ni el three sin minificar
const pieza = readFileSync("dist/piezas/home/cleveland.js", "utf8");
const imports = [...pieza.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
const vendorPedido = imports.filter((i) => i.includes("/vendor/"));
if (vendorPedido.length !== 2) mal(`la pieza importa ${vendorPedido.length} archivos de vendor: ${vendorPedido.join(", ")}`);
else if (vendorPedido.some((i) => i.includes("three.module.js"))) mal("importa three.module.js sin minificar (1,3 MB)");
else ok(`importa 2 de vendor: ${vendorPedido.map((x) => x.split("/").pop()).join(" + ")}`);

// 2 y 3 · el repintado
const papel = (pieza.match(/papel:\s*\{[\s\S]*?\},/) || [""])[0];
if (!papel) mal("no existe la paleta `papel` en la pieza");
else {
  const problemas = [];
  if (!/niebla:\s*null/.test(papel)) problemas.push("la paleta papel declara niebla");
  const anillo = (papel.match(/anillo:\s*(0x[0-9a-fA-F]{6})/) || [])[1];
  const sitio = (papel.match(/sitio:\s*(0x[0-9a-fA-F]{6})/) || [])[1];
  if (!anillo || !sitio) problemas.push("faltan los colores de anillo y sitio");
  else if (anillo.toLowerCase() === sitio.toLowerCase())
    problemas.push(`residuos fuente y sitios predichos comparten color (${anillo}) — la pieza afirmaria que coinciden`);
  if (problemas.length) problemas.forEach(mal);
  else ok(`paleta papel: sin niebla · fuente ${anillo} ≠ predicho ${sitio}`);
}
if (/UnrealBloom|EffectComposer|RenderPass/.test(pieza)) mal("la pieza trae bloom (composer) — el spec lo prohibe sobre papel");
else ok("sin bloom: no hay composer ni pases de post-proceso");
// La mezcla aditiva sigue existiendo para la paleta oscura; lo que no puede es aplicarse
// cuando la paleta es mate. Se comprueba que este condicionada, no que no exista.
const aditivas = [...pieza.matchAll(/AdditiveBlending/g)].length;
const condicionadas = [...pieza.matchAll(/LOOK\.mate\s*\?[^,;]*AdditiveBlending|AdditiveBlending[^,;]*:\s*LOOK\.mate/g)].length;
if (aditivas && !condicionadas) mal(`${aditivas} usos de AdditiveBlending sin condicionar a la paleta`);
else ok(`mezcla aditiva ${aditivas ? "condicionada a la paleta oscura" : "ausente"}`);

// 4 · carga diferida
for (const f of ["dist/pilots/index.html", "dist/es/pilotos/index.html"]) {
  const h = readFileSync(f, "utf8");
  if (/three\.module|piezas\/home\/cleveland\.js/.test(h.slice(0, h.indexOf("</head>") + 7)))
    mal(`${f} pide el motor en la cabecera — deja de ser carga diferida`);
  else if (!/pieza-3d\.js/.test(h)) mal(`${f} no monta el cargador diferido`);
  else if (!/id="pieza3d"/.test(h)) mal(`${f} no tiene el contenedor de la pieza`);
  else ok(`${f.replace("dist", "")} carga diferida, contenedor presente`);
}

if (fallos.length) { console.log(`\nT-3d: ${fallos.length} fallo(s).`); process.exit(1); }
console.log("\nT-3d: la pieza pesa lo declarado, esta repintada para papel y no se descarga hasta que se ve.");
