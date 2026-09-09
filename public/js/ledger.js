/**
 * /ledger — las tres islas: cifras, artefactos sellados y erratas.
 *
 * EL ANCLA DESPUES DE PINTAR
 * --------------------------
 * La home enlaza a /ledger#RQ-EON-QPU-001 y compañia. Esas filas las pinta esta isla, y
 * para cuando existen el navegador YA paso por el ancla: el enlace "funciona" —carga
 * /ledger— pero te deja arriba, en otra parte de la que dice. Es un enlace roto que no
 * da 404 y no da error. Por eso, despues de pintar, se salta al hash a mano.
 *
 * LA VENTANA HORNEADA Y LA ISLA TIENEN QUE LEER LA MISMA COLECCION
 * -----------------------------------------------------------
 * Las 45 filas horneadas salen de `run_archives` SIN filtrar por tipo. Por eso la
 * isla pagina /v1/archives y no /v1/runs: con /v1/runs el offset 45 caia sobre otra
 * coleccion (solo RUN) y se saltaba 25 corridas que no aparecian en ninguna pagina,
 * mientras el pie declaraba "93 de 93" con el total de RUN. El archivo tiene 136.
 *
 * Y las cifras: se toman de /v1/state, no del build. Las de la plantilla son el
 * respaldo, y si el fetch falla se rotulan en vez de vaciarse.
 */
(function () {
  "use strict";
  var ES = document.documentElement.lang === "es";
  var LIM = 25, off = 0, total = null;
  // El HTML ya trae las primeras filas (commit 10-bis). La isla arranca DESPUES de
  // ellas: si empezara en 0 y reseteara, borraria del DOM justo lo que existe para que
  // un rastreador sin JavaScript lo lea, y lo reemplazaria por lo mismo.
  var HORNEADAS = 0;
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
  function json(u){ return fetch(u,{headers:{accept:"application/json"}}).then(function(r){ if(!r.ok) throw 0; return r.json(); }); }

  function alHash() {
    if (!location.hash) return;
    var el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el) el.scrollIntoView({ block: "start" });
  }

  // ── cifras ───────────────────────────────────────────────────────────────────
  json("/v1/state").then(function (d) {
    var e = d.estado_medido || {};
    var mapa = { "rq-sealed": e.corridas_selladas, "rq-prereg": e.pre_registros, "rq-verdicts": e.veredictos_publicados,
                 "rq-errata": e.erratas, "rq-wins": e.victorias_cuanticas_medidas };
    Object.keys(mapa).forEach(function (k) {
      if (mapa[k] === undefined) return;
      document.querySelectorAll("[data-rq='" + k + "']").forEach(function (n) { n.textContent = String(mapa[k]); });
    });
  }).catch(function () {
    var m = document.querySelector('meta[name="rq-build"]');
    document.querySelectorAll("[data-rq]").forEach(function (n) {
      if (n.dataset.rqStale) return; n.dataset.rqStale = "1";
      var s = document.createElement("span");
      s.style.cssText = "font-family:var(--mono);font-size:10px;color:var(--ink-60);margin-left:6px";
      s.textContent = "as of build " + (m ? m.content.slice(0,7) : "?");
      n.appendChild(s);
    });
  });

  // ── artefactos sellados ──────────────────────────────────────────────────────
  var cuerpo = document.getElementById("artBody"), mas = document.getElementById("artMas"), den = document.getElementById("artDen");
  function copias(x){
    var l = [];
    if (x.github_raw) l.push('<a href="'+esc(x.github_raw)+'">GitHub ↗</a>');
    if (x.codeberg_raw) l.push('<a href="'+esc(x.codeberg_raw)+'">Codeberg ↗</a>');
    if (x.ots_url) l.push('<a href="'+esc(x.ots_url)+'">OTS ↗</a>');
    return l.join(" · ") || "—";
  }
  // Con filas horneadas, el total del archivo aun no se conoce: se pregunta solo por el
  // denominador, sin traerse 25 filas que ya estan en la pagina.
  function pintarDenominador() {
    json("/v1/archives?limit=1").then(function (d) {
      total = d.total_archivo;
      if (den) den.textContent = (ES ? off + " de " + total + " artefactos del archivo" : off + " of " + total + " artifacts in the archive");
      if (mas) mas.style.display = off >= total ? "none" : "";
    }).catch(function () {
      if (den) den.textContent = (ES ? off + " artefactos (horneados en el build)" : off + " artifacts (baked at build)");
    });
  }

  function pinta(reset) {
    json("/v1/archives?limit=" + LIM + "&offset=" + off).then(function (d) {
      total = d.total_archivo;
      var filas = (d.items || []).map(function (x) {
        return '<tr id="' + esc(x.id) + '">' +
          '<td class="id">' + esc(x.id) + "</td>" +
          '<td class="tipo">' + esc(x.tipo || "") + "</td>" +
          '<td class="id">' + esc(x.fecha || "") + "</td>" +
          '<td class="hash">' + esc((x.content_hash || "").replace("sha256:", "").slice(0, 16)) + "…</td>" +
          '<td class="id">' + copias(x) + "</td></tr>";
      }).join("");
      if (reset) cuerpo.innerHTML = filas; else cuerpo.insertAdjacentHTML("beforeend", filas);
      off += (d.items || []).length;
      if (den) den.textContent = (ES ? off + " de " + total + " artefactos del archivo" : off + " of " + total + " artifacts in the archive");
      if (mas) mas.style.display = off >= total ? "none" : "";
      alHash(); // el ancla existe recien ahora
    }).catch(function () {
      if (reset) cuerpo.innerHTML = '<tr><td colspan="5" class="res-vacio">' + (ES ? "No se pudo leer /v1/archives." : "/v1/archives could not be read.") + "</td></tr>";
    });
  }
  if (cuerpo) {
    HORNEADAS = parseInt(cuerpo.dataset.horneados || "0", 10) || 0;
    off = HORNEADAS;
    if (HORNEADAS) { pintarDenominador(); alHash(); } else { pinta(true); }
    if (mas) mas.addEventListener("click", function () { pinta(false); });
  }

  // ── erratas ──────────────────────────────────────────────────────────────────
  var caja = document.getElementById("errBody");
  if (caja) {
    json("/v1/erratas").then(function (d) {
      var it = d.items || [];
      if (!it.length) { caja.innerHTML = '<p class="mono" style="color:var(--ink-60)">' + (ES ? "sin erratas publicadas" : "no errata published") + "</p>"; return; }
      caja.innerHTML = it.map(function (x) {
        var n = (x.errata && x.errata.nota) || "";
        return '<div class="err" id="' + esc(x.id) + '"><div class="eid">' + esc(x.id) + " · " + esc(x.fecha || "") + "</div><p>" + esc(n) + "</p>" +
               (x.github_raw ? '<p class="mono" style="font-size:11px"><a href="' + esc(x.github_raw) + '">GitHub ↗</a></p>' : "") + "</div>";
      }).join("");
      alHash();
    }).catch(function () {
      caja.innerHTML = '<p class="mono" style="color:var(--ink-60)">' + (ES ? "No se pudo leer /v1/erratas." : "/v1/erratas could not be read.") + "</p>";
    });
  }
})();
