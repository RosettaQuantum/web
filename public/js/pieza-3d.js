/**
 * Carga DIFERIDA de la pieza 3D en /pilots (commit 13).
 *
 * three.module.min.js pesa 687 KB. Cargarlo en la cabecera de la pagina castigaria a
 * todo el que entra a leer los precios por una pieza que vive al final del scroll. Aqui
 * el modulo NO se pide hasta que el contenedor esta por entrar en pantalla.
 *
 * Y si el visitante pide menos movimiento, la pieza NO se carga: se queda el rotulo. Un
 * `prefers-reduced-motion` que igual descarga 700 KB de motor 3D respeta la letra de la
 * preferencia y no lo que pide.
 */
(function () {
  "use strict";
  var caja = document.getElementById("pieza3d");
  if (!caja) return;
  var ES = document.documentElement.lang === "es";
  var estado = caja.querySelector(".p3d-estado");
  var quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (quieto) {
    estado.textContent = ES
      ? "Movimiento reducido: la pieza no se carga. La misma medición, sellada, está en el ledger."
      : "Reduced motion: the piece is not loaded. The same measurement, sealed, is in the ledger.";
    return;
  }

  var pedido = false;
  function cargar() {
    if (pedido) return; pedido = true;
    estado.textContent = ES ? "cargando el motor…" : "loading the engine…";
    import("/piezas/home/cleveland.js")
      .then(function (m) {
        estado.textContent = ES ? "leyendo la estructura sellada…" : "reading the sealed structure…";
        m.montar(caja.querySelector(".p3d-lienzo"), { pdb: "4OBE", target: "KRAS_G12C", paleta: "papel" });
      })
      .catch(function () {
        // Se degrada a texto, no a un hueco: un contenedor vacio parece que no hay nada.
        estado.textContent = ES
          ? "La pieza no cargó. La medición está igual en el ledger, sellada."
          : "The piece did not load. The measurement is in the ledger anyway, sealed.";
      });
  }

  caja.addEventListener("pieza:lista", function (e) {
    var d = e.detail || {};
    estado.textContent = (ES ? "red desde la topología sellada · " : "network from the sealed topology · ") +
      d.nodos + (ES ? " residuos · " : " residues · ") + d.aristas + (ES ? " contactos · ρ=" : " contacts · ρ=") +
      (d.rho == null ? "—" : d.rho.toFixed(3));
  });

  if ("IntersectionObserver" in window) {
    var ojo = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { ojo.disconnect(); cargar(); } },
      { rootMargin: "300px" });
    ojo.observe(caja);
  } else { cargar(); }
})();
