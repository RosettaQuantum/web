/**
 * Los tres archivos, en un solo lugar: claims, catalogo y corridas selladas.
 *
 * POR QUE EXISTE (9-sep-2026). La home tenia su propio buscador con CATORCE titulos
 * escritos a mano, en ingles, que se mostraban igual en /es/. Dos problemas de una:
 *   - duplicaba lo que ya hace el buscador de la Biblioteca, con otra fuente;
 *   - un lector en español leia catorce titulos en ingles.
 * Y la lista de a mano envejece sola: nombraba erratas y corridas que hoy son otras.
 *
 * Ahora las dos cajas preguntan a las MISMAS tres puertas. Cada pagina conserva su
 * forma de pintar —la home una linea compacta, la Biblioteca secciones agrupadas—
 * porque eso si es distinto; lo que no puede haber son dos definiciones de "buscar".
 *
 * LAS PALABRAS SE COMBINAN CON Y, en cualquier orden, y se busca en LAS DOS CARAS de
 * cada claim: un lector ingles escribe "certified randomness" y uno español
 * "aleatoriedad certificada", y los dos tienen que dar con la misma fila.
 */
(function () {
  "use strict";
  var CLAIMS = null;

  function json(u) {
    return fetch(u, { headers: { accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); });
  }

  function palabras(q) {
    return String(q || "").toLowerCase().split(/\s+/).filter(function (w) { return w.length > 1; });
  }

  /** Los dias no se hornean: se computan con claim_date al momento de mirar. */
  function dias(desde) {
    var d = Date.parse(desde + "T00:00:00Z");
    return isNaN(d) ? null : Math.max(0, Math.floor((Date.now() - d) / 86400000));
  }

  /** Las dos caras del claim, con caida al campo de siempre si la fila no esta migrada. */
  function titulo(c, ES) { return (ES ? c.title_es : c.title_en) || c.title || ""; }
  function dominio(c, ES) { return (ES ? c.domain_es : c.domain_en) || c.domain || ""; }

  // Los claims se piden UNA vez por pagina y se guardan: la caja se usa tecleando y
  // pedirlos en cada pulsacion seria una llamada por letra.
  function cargarClaims() {
    if (CLAIMS) return Promise.resolve(CLAIMS);
    return json("/v1/claims?limit=50")
      .then(function (d) { CLAIMS = d.claims || []; return CLAIMS; })
      .catch(function () { CLAIMS = []; return CLAIMS; });
  }

  /**
   * Devuelve SIEMPRE las tres listas y las palabras con las que se busco de verdad.
   * `error` es true solo si NINGUNA puerta respondio: una lista vacia porque no hay
   * coincidencias y una lista vacia porque el archivo no contesto no son lo mismo.
   */
  function buscar(q) {
    var ws = palabras(q);
    if (!ws.length) return Promise.resolve({ claims: [], algoritmos: [], corridas: [], palabras: ws, error: false });
    return Promise.all([
      cargarClaims(),
      json("/v1/algorithms?limit=20&q=" + encodeURIComponent(q)).catch(function () { return null; }),
      json("/v1/search?limit=10&q=" + encodeURIComponent(q)).catch(function () { return null; }),
    ]).then(function (r) {
      var cl = (r[0] || []).filter(function (c) {
        var heno = [c.title, c.title_es, c.title_en, c.claimant, c.id,
                    c.domain, c.domain_es, c.domain_en, c.status]
          .filter(Boolean).join(" ").toLowerCase();
        return ws.every(function (w) { return heno.indexOf(w) >= 0; });
      });
      return {
        claims: cl,
        algoritmos: (r[1] && r[1].items) || [],
        corridas: (r[2] && r[2].items) || [],
        palabras: ws,
        error: !r[1] && !r[2] && !cl.length,
      };
    });
  }

  window.RQArchivos = { buscar: buscar, dias: dias, titulo: titulo, dominio: dominio };
})();
