/**
 * Las islas de la home — lo vivo entra por /v1/*, desde el cliente.
 *
 * POR QUE ASI (decision D1 del spec de migracion)
 * ----------------------------------------------
 * Meter "/" en run_worker_first convertiria la home en runtime en cada visita y la
 * expondria a la mina nº1. En vez de eso la home se sirve como ARCHIVO y estos scripts
 * piden JSON al mismo origen. Cero rutas nuevas en la lista blanca, cero latencia
 * añadida, y frescura real.
 *
 * REGLA DURA: si un fetch falla, NO se vacia nada. Queda el valor horneado en el build
 * y se rotula "as of <fecha del build>". Una isla vacia es peor que un dato viejo
 * declarado: el dato viejo se puede auditar, el vacio parece que no hay nada.
 *
 * Y LOS DIAS NO SE HORNEAN. "630 days" en el HTML es una resta contra la fecha del
 * build: envejece en silencio y contradice "todo numero linkea a su fuente". Aca se
 * computan al momento de mirar, con claim_date de /v1/claims.
 */
(function () {
  "use strict";

  // BaseLayout ya estampa <meta name="rq-build"> con el sha del build (sellar-version.mjs).
  // Se usa ESE en vez de agregar una etiqueta nueva: tocar un layout que comparten 39
  // paginas para poner una fecha es mas riesgo que el que resuelve.
  var m = document.querySelector('meta[name="rq-build"]');
  var BUILD = m ? "build " + m.content.slice(0, 7) : "";

  function dias(desde) {
    var d = Date.parse(desde + "T00:00:00Z");
    if (isNaN(d)) return null;
    return Math.max(0, Math.floor((Date.now() - d) / 86400000));
  }

  function marcarViejo(nodo) {
    if (!nodo || !BUILD || nodo.dataset.rqStale) return;
    nodo.dataset.rqStale = "1";
    var s = document.createElement("span");
    s.className = "rq-stale";
    s.style.cssText = "font-family:var(--mono);font-size:10px;color:var(--ink-60);margin-left:6px";
    s.textContent = "as of " + BUILD;
    nodo.appendChild(s);
  }

  // ── 1 · Survival clock: los dias se computan aqui, no en el build ────────────
  fetch("/v1/claims?limit=50", { headers: { accept: "application/json" } })
    .then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(function (d) {
      var porId = {};
      (d.claims || []).forEach(function (c) { porId[c.id] = c; });
      // Las dos cifras de claims salen de ESTE endpoint, no de /v1/state: el
      // denominador y los "en pie" son propiedad del registro, no del ledger.
      var enPie = (d.claims || []).filter(function (c) { return c.status === "surviving"; }).length;
      document.querySelectorAll("[data-rq='rq-claims-tracked']").forEach(function (n) { n.textContent = String(d.total); });
      document.querySelectorAll("[data-rq='rq-claims-surviving']").forEach(function (n) { n.textContent = String(enPie); });

      document.querySelectorAll("[data-claim]").forEach(function (fila) {
        var c = porId[fila.getAttribute("data-claim")];
        if (!c) return marcarViejo(fila.querySelector(".bar-days"));
        var b = fila.querySelectorAll(".bar-days b");
        var vividos = dias(c.claim_date);
        if (vividos === null) return marcarViejo(fila.querySelector(".bar-days"));
        // Con desafio: el primer <b> es el dia del desafio, el texto trae "of N days".
        // Sin desafio: el unico <b> son los dias vividos, y esos SI cambian cada dia.
        if (c.clock_days === null || c.clock_days === undefined) {
          if (b[0]) b[0].textContent = String(vividos);
        } else {
          if (b[0]) b[0].textContent = String(c.clock_days);
          // ES y EN escriben la misma frase distinto ("of 313 days" / "de 313 días").
          // Una expresion escrita solo para el ingles NO falla en la pagina en español:
          // simplemente no reemplaza, y el numero se queda horneado del build. Es el
          // mismo modo de fallo que este archivo existe para evitar, un idioma mas alla.
          var linea = fila.querySelector(".bar-days");
          var RE_TOTAL = document.documentElement.lang === "es" ? /de\s+\d+\s+d[ií]as/ : /of\s+\d+\s+days/;
          var TOTAL = document.documentElement.lang === "es" ? "de " + vividos + " días" : "of " + vividos + " days";
          if (linea && RE_TOTAL.test(linea.textContent)) {
            linea.innerHTML = linea.innerHTML.replace(RE_TOTAL, TOTAL);
          }
          var barra = fila.querySelector(".bar");
          if (barra && vividos > 0) barra.style.width = Math.min(100, Math.round((c.clock_days / vividos) * 100)) + "%";
        }
      });
    })
    .catch(function () {
      document.querySelectorAll("[data-claim] .bar-days").forEach(marcarViejo);
    });

  // ── 2 · Cifras del Ledger desde /v1/state ────────────────────────────────────
  fetch("/v1/state", { headers: { accept: "application/json" } })
    .then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(function (d) {
      var e = d.estado_medido || {};
      var mapa = {
        "rq-sealed": e.corridas_selladas,
        "rq-verdicts": e.veredictos_publicados,
        "rq-prereg": e.pre_registros,
        "rq-errata": e.erratas,
        "rq-wins": e.victorias_cuanticas_medidas,
      };
      Object.keys(mapa).forEach(function (k) {
        if (mapa[k] === undefined) return;
        document.querySelectorAll("[data-rq='" + k + "']").forEach(function (n) { n.textContent = String(mapa[k]); });
      });
    })
    .catch(function () {
      document.querySelectorAll("[data-rq]").forEach(marcarViejo);
    });

  // ── 3 · Notes: las dos ultimas entradas, con su extracto del cuerpo ──────────
  var cajaNotes = document.querySelector("[data-rq-notes]");
  if (cajaNotes) {
    fetch("/v1/posts?limit=2&lang=" + (document.documentElement.lang === "es" ? "es" : "en"),
      { headers: { accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) {
        if (!d.posts || !d.posts.length) throw 0;
        cajaNotes.innerHTML = d.posts.map(function (p) {
          return '<a class="note" href="/blog/' + p.slug + '/">' +
            '<div class="note-date">' + p.fecha + " · " + p.minutos + " min</div>" +
            "<h3>" + p.titulo + "</h3>" +
            "<p>" + (p.excerpt || "") + "</p></a>";
        }).join("");
      })
      .catch(function () { marcarViejo(cajaNotes); });
  }
})();
