/*
 * Alta de Q-Ready Verified (13-nov-2026), en /q-ready/verificar y /es/q-ready/verificar.
 * 1. POST /api/qready/verificado/alta con Turnstile → el registro TXT único de este pedido.
 * 2. «Comprobar» → POST /api/qready/verificado/comprobar: el Worker lee el TXT por DNS sobre HTTPS.
 *    Presente = verificado. Ausente = todavía no. Error de DNS = «intente de nuevo»: no cambia nada.
 * 3. Verificado y público → el snippet del sello para copiar.
 * Aquí no se decide nada: lo decide el servidor. El texto sale de qready-textos.mjs.
 */
import { textos, snippetSello } from "./qready-textos.mjs";
import { dominioDeEntrada } from "./qex-nucleo.mjs";

const EN = document.documentElement.lang === "en";
const T = textos(EN ? "en" : "es");
const $ = (id) => document.getElementById(id);
const form = $("qv-alta");
let token = null, ts = null;
const decir = (id, txt, mal) => { const e = $(id); e.textContent = txt; e.classList.toggle("qv-mal", !!mal); };
const ERR = EN
  ? { dominio: "Enter a public domain, for example example.com.", sector: "Choose a sector.", contacto: "Enter a valid email or leave it empty." }
  : { dominio: "Escriba un dominio público, por ejemplo ejemplo.cl.", sector: "Elija un sector.", contacto: "Escriba un correo válido o déjelo vacío." };

if (form) {
  form.addEventListener("focusin", () => { if (!ts && window.rqTurnstile) ts = window.rqTurnstile.montar($("qv-ts")); }, { once: true });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dominio = dominioDeEntrada($("qv-dominio").value);
    if (!dominio) return decir("qv-estado", ERR.dominio, true);
    $("qv-ir").disabled = true; decir("qv-estado", EN ? "Verifying…" : "Verificando…");
    if (!ts && window.rqTurnstile) ts = window.rqTurnstile.montar($("qv-ts"));
    const tk = ts ? await ts.esperarToken() : null;
    try {
      const r = await fetch("/api/qready/verificado/alta", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ dominio, sector: $("qv-sector").value, contacto: $("qv-contacto").value.trim() || null, publico: $("qv-publico").checked, turnstile: tk }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { decir("qv-estado", ERR[j.error] || (EN ? `We could not register the request (${r.status}).` : (j.error || `No pudimos registrar el pedido (${r.status}).`)), true); if (ts) ts.reiniciar(); $("qv-ir").disabled = false; return; }
      token = j.token;
      $("qv-txt-nombre").textContent = j.txt.nombre;
      $("qv-txt-valor").textContent = j.txt.valor;
      $("qv-txt").hidden = false; decir("qv-estado", "");
      $("qv-txt").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch { decir("qv-estado", EN ? "We could not connect. Try again." : "No pudimos conectar. Intente de nuevo.", true); $("qv-ir").disabled = false; }
  });

  $("qv-comprobar").addEventListener("click", async () => {
    if (!token) return;
    $("qv-comprobar").disabled = true;
    try {
      const r = await fetch("/api/qready/verificado/comprobar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, lang: EN ? "en" : "es" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) decir("qv-comprobar-estado", T.alta_error_red, true);
      else if (j.estado === "error") decir("qv-comprobar-estado", T.alta_error_red, true);
      else if (!j.verificado) decir("qv-comprobar-estado", T.alta_aun_no, true);
      else {
        decir("qv-comprobar-estado", T.alta_ok);
        $("qv-listo").hidden = false;
        if (j.publico) {
          const snip = j.snippet || snippetSello(j.dominio, EN ? "en" : "es");
          $("qv-listo-txt").textContent = T.alta_snippet;
          $("qv-snippet").textContent = snip;
          // vista previa: el mismo snippet, apuntando a este servidor
          const img = document.createElement("img");
          img.src = `/sello/${encodeURIComponent(j.dominio)}.svg`; img.width = 220; img.height = 64; img.alt = "";
          $("qv-sello-vista").replaceChildren(img);
        } else {
          $("qv-listo-txt").textContent = T.alta_privado;
          $("qv-snippet").hidden = true; $("qv-copiar").hidden = true;
        }
      }
    } catch { decir("qv-comprobar-estado", T.alta_error_red, true); }
    $("qv-comprobar").disabled = false;
  });

  $("qv-copiar").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("qv-snippet").textContent); $("qv-copiar").textContent = T.alta_copiado; }
    catch { const rg = document.createRange(); rg.selectNodeContents($("qv-snippet")); getSelection().removeAllRanges(); getSelection().addRange(rg); }
  });
}
