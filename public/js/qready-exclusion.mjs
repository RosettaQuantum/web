/*
 * El pedido de exclusión (27-nov-2026), en /q-ready/quien-mide y /es/q-ready/quien-mide.
 * POST /api/exclusion {dominio, correo, turnstile, lang} → el Worker (lib/exclusion.mjs) guarda la huella del
 * correo, no el correo, y manda un enlace de confirmación a ese correo. Aquí no se decide nada: lo decide el
 * servidor. La respuesta es la misma esté o no el dominio excluido. El texto sale de qready-textos.mjs.
 */
import { textos } from "./qready-textos.mjs";
import { dominioDeEntrada } from "./qex-nucleo.mjs";

const EN = document.documentElement.lang === "en";
const E = textos(EN ? "en" : "es").quien_estado;
const $ = (id) => document.getElementById(id);
const form = $("qx-form");
let ts = null;
const decir = (txt, mal) => { const e = $("qx-estado"); e.textContent = txt; e.classList.toggle("qv-mal", !!mal); };
// La misma regla que el servidor (correoDelDominio en lib/exclusion.mjs): el correo es del dominio o de un subdominio.
const delDominio = (correo, dominio) => { const h = correo.split("@")[1] || ""; return correo.split("@").length === 2 && (h === dominio || h.endsWith("." + dominio)); };

if (form) {
  form.addEventListener("focusin", () => { if (!ts && window.rqTurnstile) ts = window.rqTurnstile.montar($("qx-ts")); }, { once: true });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dominio = dominioDeEntrada($("qx-dominio").value);
    const correo = $("qx-correo").value.trim().toLowerCase();
    if (!dominio) return decir(E.dominio, true);
    if (!delDominio(correo, dominio)) return decir(E.correo, true);
    $("qx-ir").disabled = true; decir(E.enviando);
    if (!ts && window.rqTurnstile) ts = window.rqTurnstile.montar($("qx-ts"));
    const tk = ts ? await ts.esperarToken() : null;
    try {
      const r = await fetch("/api/exclusion", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ dominio, correo, turnstile: tk, lang: EN ? "en" : "es" }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { decir(E.ok); form.reset(); }
      else {
        const msg = r.status === 403 ? E.persona : r.status === 429 ? E.demasiados : r.status === 503 ? E.no_habilitado
          : j.error === "correo" ? E.correo : j.error === "dominio" ? E.dominio : E.red;
        decir(msg, true);
      }
    } catch { decir(E.red, true); }
    if (ts) ts.reiniciar();
    $("qx-ir").disabled = false;
  });
}
