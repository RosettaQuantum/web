/**
 * B10.2 · La franja de frescura del registro, bajo la barra.
 *
 * POR QUE. El sitio publica 93 corridas selladas y en ninguna parte dice cuando fue la
 * ultima. Un registro sin fecha de actualizacion se asume muerto — y este se actualiza
 * de verdad, asi que callarlo trabaja en contra.
 *
 * DOS REGLAS QUE VIENEN DE ERRORES YA PAGADOS EN ESTE REPO:
 *  1. Los dias NO se hornean: se computan con la fecha del sello al momento de mirar.
 *     Una resta hecha en el build envejece sola y nadie la revisa.
 *  2. Si el archivo no responde, la franja NO aparece. Nada de "actualizado a diario"
 *     sin poder decir cuando: una promesa sin su dato es exactamente lo que este sitio
 *     existe para no hacer.
 */
(function () {
  "use strict";
  var caja = document.getElementById("frescura");
  if (!caja) return;
  var ES = document.documentElement.lang === "es";
  /* DESVIACION DECLARADA DEL ANEXO A. El spec pedia «Registry updated daily». Medido:
     la ultima corrida sellada es de hace 15 dias, asi que esa frase la desmiente
     nuestro propio /v1/runs — el lector la lee como «entran corridas todos los dias» y
     ve quince. Lo que SI es diario es la auditoria, y ya esta publicado en
     /v1/state.integridad.auditoria = "diaria, automatica" y en el pie de /ledger.
     Se dice eso, que es verdad y esta sellado. (CLAUDE.md 1 ter: antes de publicar una
     afirmacion, preguntar si algun endpoint propio la desmiente.) */
  var t = ES
    ? { ultima: "Última corrida sellada: hace", dias: "días", hoy: "hoy", ayer: "ayer",
        cadencia: "Auditoría del archivo: diaria", corridas: "corridas" }
    : { ultima: "Last sealed run:", dias: "days ago", hoy: "today", ayer: "yesterday",
        cadencia: "Archive audited daily", corridas: "runs" };

  function json(u) {
    return fetch(u, { headers: { accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); });
  }

  Promise.all([json("/v1/runs?limit=1"), json("/v1/state")]).then(function (r) {
    var fecha = r[0] && r[0].items && r[0].items[0] && r[0].items[0].fecha;
    var total = r[1] && r[1].estado_medido && r[1].estado_medido.corridas_selladas;
    if (!fecha || typeof total !== "number") return;      // sin dato, sin franja
    var ms = Date.now() - Date.parse(fecha + "T00:00:00Z");
    var d = Math.max(0, Math.floor(ms / 86400000));
    var cuando = d === 0 ? t.hoy : d === 1 ? t.ayer : (ES ? t.ultima + " " + d + " " + t.dias : d + " " + t.dias);
    var texto = ES
      ? (d <= 1 ? "Última corrida sellada: " + cuando : cuando)
      : (d <= 1 ? "Last sealed run: " + cuando : t.ultima + " " + cuando);
    caja.textContent = texto + " · " + t.cadencia + " · " + total + " " + t.corridas;
    caja.hidden = false;
  }).catch(function () { /* sin dato, sin franja */ });
})();
