/*
 * El validador de /.well-known/q-ready (13-nov-2026), en /q-ready/spec y /es/q-ready/spec.
 * Manda {url} o {json} a POST /api/qready/well-known/validar: la firma la comprueba el servidor con
 * las mismas funciones que firman el nuestro (public/js/qready-wellknown.mjs). Aquí sólo se pinta.
 */
import { textos } from "./qready-textos.mjs";
const EN = document.documentElement.lang === "en";
const T = textos(EN ? "en" : "es");
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const form = $("qv-val");
if (form) form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = $("qv-val-url").value.trim(), texto = $("qv-val-json").value.trim();
  if (!url && !texto) return;
  $("qv-val-ir").disabled = true; $("qv-val-estado").textContent = "…"; $("qv-val-errores").innerHTML = ""; $("qv-val-cruce").innerHTML = "";
  try {
    const r = await fetch("/api/qready/well-known/validar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(texto ? { json: texto } : { url }) });
    const j = await r.json().catch(() => ({}));
    const est = $("qv-val-estado");
    if (!j.ok) { est.textContent = j.error || `${r.status}`; est.classList.add("qv-mal"); }
    else {
      const vencido = !j.vigente && j.firma && j.firma.ok;
      est.textContent = j.valido ? T.val_ok : vencido ? T.val_vencido : T.val_mal;
      est.classList.toggle("qv-mal", !j.valido);
      $("qv-val-errores").innerHTML = (j.errores || []).map((x) => `<li>${esc(x)}</li>`).join("");
      const c = j.cruce || { items: [] };
      $("qv-val-cruce").innerHTML = `<p><b>${esc(T.val_cruce_titulo)}</b></p>` + (c.items && c.items.length
        ? `<ul class="qv-res-lista">${c.items.map((i) => `<li><code>${esc(i.campo)}</code>: ${esc(i.declarado)} / ${esc(i.medido ?? T.val_sin_dato)} · ${esc(i.calza === true ? T.val_calza : i.calza === false ? T.val_no_calza : T.val_sin_dato)}</li>`).join("")}</ul>`
        : `<p class="qv-meta">${esc(T.val_cruce_sin)}</p>`);
    }
  } catch { $("qv-val-estado").textContent = EN ? "We could not connect." : "No pudimos conectar."; }
  $("qv-val-ir").disabled = false;
});
