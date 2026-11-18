/*
 * Pop-up de la guía PQC (17-nov-2026). Marcado y estilo en src/components/PromoGuia.astro.
 *
 * Reglas del encargo, y dónde se cumple cada una:
 *  · nunca en /guia/* ni /guide/*                     → esGuia(), antes de programar nada
 *  · una vez por sesión                                → sessionStorage, al MOSTRAR
 *  · cerrado = 30 días sin volver                      → localStorage, al CERRAR
 *  · ~8 s o 40 % de scroll, lo que ocurra primero      → disparar()
 *  · nunca con el modal de leads abierto               → modalAbierto(), y lo reintenta
 *  · sólo si el flag de D1 está en '1' Y la guía está publicada → lo decide el Worker en
 *    /api/promo/guia; aquí no se adivina nada. Hasta el disparo no hay ni una petición.
 *  · medición: POST /_promo/guia/{view,click,close} → tabla `hits`
 * Todo acceso a storage va en try/catch: con el almacenamiento bloqueado el pop-up sigue
 * funcionando, sólo que sin memoria.
 *
 * scripts/check-guia.mjs ejecuta ESTE archivo en una página de mentira y lo muta.
 */
(function () {
  "use strict";
  var CLAVE = "rq-promo-guia";
  var CLAVE_CERRADO = "rq-promo-guia:cerrado";
  var DIAS = 30, MS_DIA = 864e5, ESPERA_MS = 8000, UMBRAL = 0.4;

  function esGuia(ruta) { return /^\/(?:guia|guide)(?:\/|$)/.test(ruta || ""); }
  function leer(tipo, k) { try { return window[tipo].getItem(k); } catch (e) { return null; } }
  function escribir(tipo, k, v) { try { window[tipo].setItem(k, v); } catch (e) { /* sin memoria */ } }
  function cerradoReciente() {
    var t = Number(leer("localStorage", CLAVE_CERRADO));
    return t > 0 && Date.now() - t < DIAS * MS_DIA;
  }
  function yaVisto() { return !!leer("sessionStorage", CLAVE) || cerradoReciente(); }
  function modalAbierto() { return !!document.querySelector("#leadModal.open"); }
  function medir(ev) {
    var u = "/_promo/guia/" + ev;
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(u)) return;
      fetch(u, { method: "POST", keepalive: true, credentials: "omit" }).catch(function () {});
    } catch (e) { /* la medición nunca rompe la página */ }
  }

  // `?promo=1`: fuerza el aviso para poder verlo, sin memoria de sesión ni de cierre. Sólo
  // tiene efecto en el preview: el Worker de producción ignora el parámetro (lib/guia.mjs →
  // promoForzado), así que allí sigue mandando el flag de D1.
  var forzar = /(?:^|[?&])promo=1(?:&|$)/.test(location.search || "");
  var el = document.getElementById("rqPromo");
  if (!el || esGuia(location.pathname) || (!forzar && yaVisto())) return;

  var lang = el.getAttribute("data-lang") === "es" ? "es" : "en";
  var disparado = false, reloj = null, paddingPrevio = "";

  function alScroll() {
    var d = document.documentElement, max = d.scrollHeight - window.innerHeight;
    if (max > 0 && (window.scrollY || d.scrollTop) / max >= UMBRAL) disparar();
  }

  function disparar() {
    if (disparado) return;
    disparado = true;
    clearTimeout(reloj);
    window.removeEventListener("scroll", alScroll);
    fetch("/api/promo/guia?lang=" + lang + (forzar ? "&promo=1" : ""), { credentials: "omit" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (j && j.mostrar === true && typeof j.href === "string" && /^\/(?:guia|guide)\/[\w-]+$/.test(j.href)) mostrar(j.href);
      })
      .catch(function () {});
  }

  function mostrar(href) {
    if (modalAbierto()) { setTimeout(function () { mostrar(href); }, 2000); return; }
    if (!forzar && yaVisto()) return;   // otra pestaña de la misma sesión ya lo mostró o lo cerró
    var ir = el.querySelector("[data-promo-ir]");
    ir.setAttribute("href", href);
    var img = el.querySelector("img[data-src]");
    if (img) { img.setAttribute("src", img.getAttribute("data-src")); img.removeAttribute("data-src"); }
    el.hidden = false;
    // No tapar contenido: el final de la página tiene que poder subir por encima del aviso.
    paddingPrevio = document.body.style.paddingBottom;
    document.body.style.paddingBottom = (el.offsetHeight + 24) + "px";
    escribir("sessionStorage", CLAVE, "1");
    medir("view");
  }

  function cerrar() {
    if (el.hidden) return;
    el.hidden = true;
    document.body.style.paddingBottom = paddingPrevio;
    escribir("localStorage", CLAVE_CERRADO, String(Date.now()));
    medir("close");
  }

  el.querySelector("[data-promo-cerrar]").addEventListener("click", cerrar);
  el.querySelector("[data-promo-ir]").addEventListener("click", function () { medir("click"); });
  // En fase de CAPTURA: así se mira el modal ANTES de que su propio Esc lo cierre. Sin esto,
  // un Esc para cerrar el modal de leads cerraba también este aviso.
  document.addEventListener("keydown", function (e) {
    if ((e.key === "Escape" || e.key === "Esc") && !el.hidden && !modalAbierto()) cerrar();
  }, true);

  reloj = setTimeout(disparar, ESPERA_MS);
  window.addEventListener("scroll", alScroll, { passive: true });
})();
