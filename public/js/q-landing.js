/**
 * Embudo de /es/q — la landing pagada. Su contraparte en el servidor es lib/q-eventos.mjs,
 * que ya existia y estaba desplegada midiendo una pagina que no existia: el 25-nov-2026
 * `q_events` tenia CERO filas. Este archivo es el unico que las escribe.
 *
 * TRES DECISIONES, y por que:
 *
 *  · EL LADO SE ELIGE UNA VEZ POR VISITA. La pagina es estatica y la sirve el CDN, asi que
 *    el reparto no puede pasar en el servidor: el primer visitante fijaria el lado de todos
 *    los demas que cayeran en la misma copia cacheada. Pasa aqui. El aviso puede forzarlo
 *    con `?lado=`, y si no viene se sortea y se guarda en `sessionStorage`. Sin guardarlo, un
 *    clic en la propia pagina volveria a sortear y la misma persona contaria para los dos
 *    lados: eso no es un A/B, es ruido.
 *
 *  · SIN JAVASCRIPT SE VE EL LADO `seguridad`. La hoja esconde `lab` y este archivo invierte
 *    la decision. Al reves —esconder los dos y que JS muestre uno— una persona con JS
 *    bloqueado veria una pagina en blanco: la mitad del trafico pagado a una hoja vacia.
 *
 *  · EL EVENTO VA POR `sendBeacon`. Sobrevive a que la pestana se cierre, que es exactamente
 *    cuando ocurre un `outbound`. `fetch` normal se cancela al navegar y el ultimo evento de
 *    cada visita —el que dice a donde se fue— se perderia siempre.
 *
 * Lo que este archivo NO manda: ninguna cadena escrita por el visitante. Los campos de texto
 * del formulario van al lead (`/api/lead`), nunca a `q_events`. La tabla de medicion guarda
 * vocabulario cerrado (`ev`, `side`, `cta`) y parametros de campana, y nada mas.
 */
(function () {
  "use strict";

  var LADOS = ["seguridad", "lab"];
  var qs = new URLSearchParams(location.search);

  function leer(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function escribir(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* modo privado */ } }

  // ── 1 · el lado ────────────────────────────────────────────────────────────────
  var pedido = (qs.get("lado") || "").toLowerCase();
  var lado = LADOS.indexOf(pedido) >= 0 ? pedido : leer("q.lado");
  if (LADOS.indexOf(lado) < 0) lado = Math.random() < 0.5 ? LADOS[0] : LADOS[1];
  escribir("q.lado", lado);
  document.documentElement.setAttribute("data-q-lado", lado);

  // El <title> se escribe en el build y es uno solo, pero la pagina tiene dos discursos: un
  // aviso del lado `lab` aterrizaba en una pestana que hablaba de migracion. El del lado
  // `seguridad` ya es el del build, asi que solo se corrige el otro.
  if (lado === "lab") {
    document.title = "Arbitraje de afirmaciones cu\u00e1nticas: la medimos antes de que firme \u2014 Rosetta Quantum";
  }

  // La pagina de llegada de ESTA visita, no la de este clic: si manana hay mas de una
  // pantalla, `path` dira donde esta y `landing` por donde entro.
  if (!leer("q.landing")) escribir("q.landing", location.pathname);

  // ── 2 · el evento ──────────────────────────────────────────────────────────────
  var CAMPANA = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "msclkid"];

  function evento(ev, cta) {
    var d = { ev: ev, side: lado, path: location.pathname, landing: leer("q.landing") };
    if (cta) d.cta = cta;
    for (var i = 0; i < CAMPANA.length; i++) {
      var v = qs.get(CAMPANA[i]);
      if (v) d[CAMPANA[i]] = v;
    }
    var cuerpo = JSON.stringify(d);
    try {
      if (navigator.sendBeacon) {
        if (navigator.sendBeacon("/api/q/event", new Blob([cuerpo], { type: "application/json" }))) return;
      }
    } catch (e) { /* cae al fetch */ }
    try {
      fetch("/api/q/event", { method: "POST", headers: { "content-type": "application/json" }, body: cuerpo, keepalive: true });
    } catch (e) { /* la medicion nunca puede romper la pagina */ }
  }

  evento("view", null);

  // ── 3 · lo que hace la persona ─────────────────────────────────────────────────
  document.addEventListener("click", function (e) {
    // `a[data-cta]` y botones que NO son el submit, a proposito. Antes esto decia
    // `closest("[data-cta]")` a secas, y el formulario entero lleva `data-cta` para rotular
    // su `form_start`: un clic en el campo del dominio, otro en el del correo y otro en el
    // boton daban TRES `cta` por un solo envio. Medido en el preview el 25-nov-2026 — ids
    // 9, 10 y 11 de `q_events`, los tres del mismo segundo. La razon visita→cta→envio es el
    // unico numero por el que se decide si una campana sirve, y asi salia inflada 3x.
    // El submit queda fuera porque su evento propio es `form_submit`: contarlo dos veces,
    // con dos nombres, es el mismo clic pasando por caja dos veces.
    var a = e.target && e.target.closest ? e.target.closest("a[data-cta], button[data-cta]:not([type=submit])") : null;
    if (a) { evento("cta", a.getAttribute("data-cta")); return; }
    var l = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!l) return;
    var h = l.getAttribute("href") || "";
    // Un `outbound` es salir del sitio. Un ancla o una ruta interna no lo son.
    if (/^(https?:)?\/\//i.test(h)) {
      try { if (new URL(l.href).host !== location.host) evento("outbound", l.getAttribute("data-cta") || null); } catch (x) { }
    } else if (/^mailto:|^tel:/i.test(h)) {
      evento("outbound", "correo");
    }
  }, true);

  var formas = document.querySelectorAll("form.q-forma");
  Array.prototype.forEach.call(formas, function (f) {
    var arranco = false;
    f.addEventListener("focusin", function () {
      if (arranco) return;          // `form_start` es uno por formulario, no uno por campo
      arranco = true;
      evento("form_start", f.getAttribute("data-cta"));
    });

    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = f.querySelector("button[type=submit]");
      var aviso = f.querySelector(".q-aviso");
      var mail = (f.querySelector("input[type=email]") || {}).value || "";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail.trim())) {
        if (aviso) aviso.textContent = "Revise el correo: falta el @ o el dominio.";
        return;
      }
      var org = f.querySelector("input[name=org]");
      var nota = f.querySelector("input[name=nota]") || f.querySelector("textarea[name=nota]");
      if (btn) { btn.disabled = true; btn.textContent = btn.getAttribute("data-espera") || "Enviando…"; }
      if (aviso) aviso.textContent = "";

      fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: mail.trim(),
          org: org ? (org.value || "").trim() : null,
          note: nota ? (nota.value || "").trim() : null,
          // `problem_class` lleva el lado: sin el, el lead llega sin saber que aviso lo trajo.
          problem_class: lado,
          lang: "es",
          // Lista blanca del servidor (worker.js). Lo que no esta ahi cae a "site-modal".
          source: "q-landing",
        }),
      }).then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        evento("form_submit", f.getAttribute("data-cta"));
        f.innerHTML = '<p class="lede" style="margin:0">Recibido. Le escribimos a <b></b> con la medición de su dominio.</p>';
        var b = f.querySelector("b");
        if (b) b.textContent = mail.trim();
      }).catch(function () {
        if (btn) { btn.disabled = false; btn.textContent = btn.getAttribute("data-boton") || "Enviar"; }
        // No se dice "enviado" cuando no se envio: eso es una promesa falsa a una persona real.
        if (aviso) aviso.textContent = "No se pudo enviar. Escríbanos a hello@rosettaquantum.com y lo tomamos igual.";
      });
    });
  });
})();
