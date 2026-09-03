/**
 * Las cuatro paginas cortas del commit 9. Nada de esto necesita servidor salvo los dos
 * formularios, que van a endpoints que YA existen (/api/lead y /api/monitor-lead).
 *
 * /verify recomputa el sha256 con SubtleCrypto EN EL NAVEGADOR. El archivo no sale de la
 * maquina del lector. Si el calculo corriera en nuestro servidor, el lector tendria que
 * confiar en nosotros para comprobar nuestro sello — que es exactamente lo contrario de
 * lo que la pagina promete.
 */
(function () {
  "use strict";
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
  var ES = document.documentElement.lang === "es";

  // ── erratas ──────────────────────────────────────────────────────────────────
  var err = document.getElementById("errBody");
  if (err) {
    fetch("/v1/erratas", { headers: { accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) {
        var it = d.items || [];
        if (!it.length) { err.innerHTML = '<p class="mono" style="color:var(--ink-60)">' + (ES ? "sin erratas publicadas" : "no errata published") + "</p>"; return; }
        err.innerHTML = it.map(function (x) {
          return '<div class="err" id="' + esc(x.id) + '"><div class="eid">' + esc(x.id) + " · " + esc(x.fecha || "") + "</div><p>" +
            esc((x.errata && x.errata.nota) || "") + "</p>" +
            (x.github_raw ? '<p class="mono" style="font-size:11px"><a href="' + esc(x.github_raw) + '">GitHub ↗</a></p>' : "") + "</div>";
        }).join("");
        if (location.hash) { var e = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (e) e.scrollIntoView(); }
      })
      .catch(function () { err.innerHTML = '<p class="mono" style="color:var(--ink-60)">' + (ES ? "No se pudo leer /v1/erratas." : "/v1/erratas could not be read.") + "</p>"; });
  }

  // ── contacto ─────────────────────────────────────────────────────────────────
  var cGo = document.getElementById("cGo");
  if (cGo) {
    cGo.addEventListener("click", function () {
      var m = (document.getElementById("cMail").value || "").trim();
      var q = (document.getElementById("cMsg").value || "").trim();
      if (!m) return;
      fetch("/api/lead", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: m, mensaje: q }) })
        .then(function (r) { if (!r.ok) throw 0; cGo.textContent = cGo.dataset.ok; cGo.disabled = true; })
        .catch(function () { cGo.textContent = cGo.dataset.mal; });
    });
  }

  // ── monitor ──────────────────────────────────────────────────────────────────
  var mMail = document.getElementById("monMail"), mGo = document.getElementById("monGo");
  if (mMail && mGo) {
    mGo.addEventListener("click", function (ev) {
      var v = (mMail.value || "").trim();
      if (!v) return; // sin correo, que siga el mailto
      ev.preventDefault();
      fetch("/api/monitor-lead", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: v }) })
        .then(function (r) { if (!r.ok) throw 0; mGo.textContent = mGo.dataset.ok; mMail.disabled = true; })
        .catch(function () { window.location.href = mGo.getAttribute("href"); });
    });
  }

  // ── verificar un sello ───────────────────────────────────────────────────────
  var vGo = document.getElementById("vGo");
  if (vGo) {
    vGo.addEventListener("click", function () {
      var f = document.getElementById("vFile").files[0];
      var esperado = (document.getElementById("vHash").value || "").trim().replace(/^sha256:/i, "").toLowerCase();
      var out = document.getElementById("vOut");
      if (!f || !esperado) { out.innerHTML = '<span class="ver-mal">' + esc(vGo.dataset.falta) + "</span>"; return; }
      f.arrayBuffer().then(function (buf) { return crypto.subtle.digest("SHA-256", buf); }).then(function (h) {
        var hex = [...new Uint8Array(h)].map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
        var igual = hex === esperado;
        out.innerHTML = esc(vGo.dataset.calc) + " " + esc(hex) + "<br><b class=\"" + (igual ? "ver-ok" : "ver-mal") + "\">" +
          esc(igual ? vGo.dataset.igual : vGo.dataset.distinto) + "</b>";
      });
    });
  }
})();
