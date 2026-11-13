/*
 * /verificado/<dominio> (13-nov-2026): «Verificar la huella». Recalcula en ESTE navegador el sha256 de
 * cada foto del historial con fotoIntegra() de qex-nucleo.mjs —la misma huella que selló el servidor—
 * y dice si coincide. No pide nada a la red: las fotos vienen en la página (script application/json).
 */
import { fotoIntegra } from "./qex-nucleo.mjs";
import { textos } from "./qready-textos.mjs";

const T = textos(document.documentElement.lang === "en" ? "en" : "es");
let fotos = [];
try { fotos = JSON.parse(document.getElementById("qv-fotos")?.textContent || "[]"); } catch { fotos = []; }
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button.qv-ver");
  if (!b) return;
  const i = Number(b.dataset.i), salida = document.querySelector(`.qv-res[data-r="${i}"]`);
  let ok = false;
  try { ok = await fotoIntegra(JSON.parse(fotos[i])); } catch { ok = false; }
  salida.textContent = ok ? T.pag_verificar_ok : T.pag_verificar_mal;
  salida.classList.toggle("qv-ok", ok); salida.classList.toggle("qv-mal", !ok);
});
