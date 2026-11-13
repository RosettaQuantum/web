/*
 * El texto del sello cabe en el sello (13-nov-2026).
 *
 * Defecto real que lo motivó: el sello de rosettaquantum.com, en 220 px, cortaba la firma en
 * «Q-Ready Verified · Rose». Este guardia arma el SVG con la función de producción y exige que
 * cada línea quepa (o venga comprimida con textLength) y que el snippet declare el mismo ancho.
 */
export const CONSUMIDOR = { quien: "el prebuild (bloquea el deploy) y quien edite selloSvg o snippetSello", hace: "agranda el sello o comprime la línea antes de que el texto se salga del recuadro" };
import { registerHooks } from "node:module";
registerHooks({ resolve: (esp, ctx, sig) => esp === "cloudflare:sockets"
  ? { url: "data:text/javascript,export function connect(){throw new Error('sin sockets en el guardia')}", shortCircuit: true } : sig(esp, ctx) });
const { selloSvg, SELLO, anchoTexto } = await import("../lib/qready-verificado.mjs");
const { FIRMA, snippetSello } = await import("../public/js/qready-textos.mjs");

const fallas = [];
const tokens = { paper: "#F4F5F1", line: "#D9DBD6", panel: "#FBFBF9", ink: "#16181B", "ink-60": "#4A4E48", verdict: "#0C7268", pending: "#8A6D1F", alert: "#9B2C2C" };
const cabe = (svg, texto, px, em, esp = 0) => {
  const disponible = SELLO.ancho - SELLO.x - SELLO.margen;
  if (anchoTexto(texto, px, em, esp) <= disponible) return true;
  return new RegExp(`textLength="${disponible}"[^>]*>${texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<`).test(svg);
};

// grito: el caso real (firma) y un dominio largo
for (const dominio of ["rosettaquantum.com", "portal-de-pagos.subdominio-muy-largo.ejemplo.cl", "a".repeat(60) + ".cl"]) {
  const svg = selloSvg({ dominio, nota: "A", fecha: "2026-11-13T18:01:15Z", tokens });
  if (!new RegExp(`width="${SELLO.ancho}"`).test(svg)) fallas.push(`el SVG no declara ancho ${SELLO.ancho}`);
  if (!cabe(svg, FIRMA, 10, 0.6, 0.3)) fallas.push(`la firma no cabe en ${SELLO.ancho} px`);
  if (!cabe(svg, dominio, 12, 0.62)) fallas.push(`el dominio ${dominio.slice(0, 20)}… no cabe ni se comprime`);
}
// silencio: un dominio corto no se comprime (no se deforma lo que ya cabe)
if (/textLength/.test(selloSvg({ dominio: "ejemplo.cl", nota: "B", fecha: null, tokens }).split("ejemplo.cl")[0].split("<text").pop()))
  fallas.push("un dominio corto quedó comprimido");
// el snippet pide el mismo tamaño que el SVG
if (!snippetSello("ejemplo.cl").includes(`width="${SELLO.ancho}" height="${SELLO.alto}"`)) fallas.push("el snippet no usa el tamaño del sello");

if (fallas.length) { console.error("check-sello-cabe: FALLA\n  " + fallas.join("\n  ")); process.exit(1); }
console.log("check-sello-cabe: ok");
