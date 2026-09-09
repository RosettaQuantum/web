/**
 * La Biblioteca: buscador y registro, contra /v1/* desde el cliente.
 *
 * Igual que las islas de la home (decision de arquitectura D1 del spec): la pagina se sirve como ARCHIVO
 * y lo vivo entra por fetch. Cero rutas nuevas en run_worker_first, cero exposicion a la
 * el fallo silencioso de la lista blanca.
 *
 * TRES REGLAS QUE VIENEN DE ERRORES YA PAGADOS
 * -------------------------------------------
 * 1. El DENOMINADOR viaja con el numero. /v1/claims trae `verificados` (16) y `total`,
 *    que es cuantos devolvio con el limite puesto — no el universo. Aqui se usa
 *    `verificados`, y los 3 no verificados se declaran en pantalla en vez de callarse.
 * 2. Los DIAS no se hornean: se computan con claim_date al momento de mirar.
 * 3. Si un fetch falla NO se vacia nada: se rotula. Una lista vacia parece "no hay nada".
 */
(function () {
  "use strict";
  var ES = document.documentElement.lang === "es";
  var t = ES
    ? { claims:"Claims rastreados", algos:"Algoritmos del catálogo", runs:"Corridas selladas",
        vacio:"Sin coincidencias. Prueba con el nombre del vendor, la clase de problema o un id.",
        error:"No se pudo consultar el archivo. Vuelve a intentar.",
        sinDesafio:"sin desafío registrado", dias:"días", de:"de", pista:"Escribe para buscar en los tres archivos." }
    : { claims:"Claims tracked", algos:"Catalogue algorithms", runs:"Sealed runs",
        vacio:"No matches. Try a vendor name, a problem class or an id.",
        error:"The archive could not be reached. Try again.",
        sinDesafio:"no challenge on record", dias:"days", de:"of", pista:"Type to search all three archives." };

  // Las dos caras del claim. Cae al campo de siempre si la fila todavia no esta
  // migrada: una pagina a medio idioma es preferible a una pagina vacia.
  function titulo(c){ return (ES ? c.title_es : c.title_en) || c.title || ""; }
  function dominio(c){ return (ES ? c.domain_es : c.domain_en) || c.domain || ""; }

  function dias(desde){ var d=Date.parse(desde+"T00:00:00Z"); return isNaN(d)?null:Math.max(0,Math.floor((Date.now()-d)/86400000)); }
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
  function json(u){ return fetch(u,{headers:{accept:"application/json"}}).then(function(r){ if(!r.ok) throw 0; return r.json(); }); }

  // ── Buscador ────────────────────────────────────────────────────────────────
  // Las tres puertas y la regla de coincidencia viven en /js/lib/archivos.js, que es
  // el MISMO modulo que usa la caja de la home. Aca queda solo la forma de pintar:
  // secciones agrupadas con su cuenta, que es lo que si es propio de esta pagina.
  var caja = document.getElementById("libQ"), out = document.getElementById("libRes"), btn = document.getElementById("libGo");
  if (caja && out) {
    var timer, token = 0;
    function buscar(q) {
      q = (q || "").trim();
      if (!q) { out.innerHTML = '<div class="res-vacio">' + t.pista + "</div>"; return; }
      var mio = ++token;
      RQArchivos.buscar(q).then(function (r) {
        // La respuesta que llega tarde no pisa a la que el lector esta viendo.
        if (mio !== token) return;
        if (r.error) { out.innerHTML = '<div class="res-vacio">' + t.error + "</div>"; return; }
        var h = "";
        if (r.claims.length) {
          h += '<div class="res-grp">' + t.claims + " · " + r.claims.length + "</div>";
          h += r.claims.map(function (c) {
            var v = RQArchivos.dias(c.claim_date);
            return '<a class="res-row" href="' + (ES ? "/es/biblioteca/registro" : "/library/registry") + '#' + esc(c.id) + '">' +
              '<span class="res-t"><b>' + esc(RQArchivos.titulo(c, ES)) + "</b> · " + esc(c.claimant) + "</span>" +
              '<span class="res-m">' + esc(c.status) + (v !== null ? " · " + v + " " + t.dias : "") + "</span></a>";
          }).join("");
        }
        if (r.algoritmos.length) {
          h += '<div class="res-grp">' + t.algos + " · " + r.algoritmos.length + "</div>";
          h += r.algoritmos.map(function (a) {
            return '<div class="res-row"><span class="res-t"><b>' + esc(a.nombre) + "</b> · " + esc(a.categoria) + "</span>" +
              '<span class="res-m">' + esc(a.speedup_declarado || "—") + "</span></div>";
          }).join("");
        }
        if (r.corridas.length) {
          h += '<div class="res-grp">' + t.runs + " · " + r.corridas.length + "</div>";
          h += r.corridas.map(function (x) {
            return '<a class="res-row" href="' + (ES ? "/es/ledger" : "/ledger") + '#' + esc(x.recipe_id || x.id) + '">' +
              '<span class="res-t"><b>' + esc(x.id) + "</b> · " + esc(x.tipo || "") + "</span>" +
              '<span class="res-m">' + esc(x.fecha || "") + "</span></a>";
          }).join("");
        }
        out.innerHTML = h || '<div class="res-vacio">' + t.vacio + "</div>";
      });
    }
    caja.addEventListener("input", function(e){ clearTimeout(timer); var v=e.target.value; timer=setTimeout(function(){ buscar(v); },180); });
    if (btn) btn.addEventListener("click", function(){ buscar(caja.value); });
    caja.addEventListener("keydown", function(e){ if (e.key === "Enter") { e.preventDefault(); buscar(caja.value); } });
    document.querySelectorAll(".hs-chip").forEach(function(ch){
      ch.addEventListener("click", function(){ caja.value = ch.textContent; buscar(ch.textContent); caja.focus(); });
    });
    buscar("");
  }

  // ── Registro ────────────────────────────────────────────────────────────────
  var tabla = document.getElementById("regBody"), den = document.getElementById("regDen");
  if (tabla) {
    json("/v1/claims?limit=50").then(function(d){
      var cl = d.claims || [];
      tabla.innerHTML = cl.map(function(c){
        var v = dias(c.claim_date);
        var barra;
        if (c.clock_days === null || c.clock_days === undefined) {
          // Sin desafio no hay fraccion que dibujar. Pintar la barra llena diria
          // "sobrevivio el 100%", que es una afirmacion, no el dato.
          barra = '<div class="sinbarra">' + t.sinDesafio + "</div>";
        } else {
          var pct = v > 0 ? Math.min(100, Math.round((c.clock_days / v) * 100)) : 0;
          barra = '<div class="sinbarra">' + c.clock_days + " " + t.de + " " + (v===null?"—":v) + " " + t.dias +
                  '</div><div class="track"><div class="fill ' + esc(c.status) + '" style="width:' + pct + '%"></div></div>';
        }
        return '<tr id="' + esc(c.id) + '">' +
          '<td class="id">' + esc(c.id) + "</td>" +
          "<td><b>" + esc(titulo(c)) + "</b><br><span class=\"res-m\">" + esc(c.claimant) + " · " + esc(dominio(c) || "—") + "</span></td>" +
          '<td class="id">' + esc(c.claim_date) + "</td>" +
          '<td class="st ' + esc(c.status) + '">' + esc(c.status) + "</td>" +
          "<td>" + barra + "</td>" +
          '<td class="id">' + (c.url ? '<a href="' + esc(c.url) + '">↗</a>' : "") + "</td></tr>";
      }).join("");
      if (den) {
        den.textContent = (ES
          ? "En la tabla " + d.en_la_tabla + " · servidos " + d.verificados + " verificados · " + d.no_verificados_excluidos + " sin verificar, excluidos a propósito. Vocabulario de estado: el de D1, sin traducir."
          : "In the table " + d.en_la_tabla + " · served " + d.verificados + " verified · " + d.no_verificados_excluidos + " unverified, excluded on purpose. Status vocabulary: D1's, untranslated.");
      }
    }).catch(function(){
      tabla.innerHTML = '<tr><td colspan="6" class="res-vacio">' + t.error + "</td></tr>";
    });
  }
})();
