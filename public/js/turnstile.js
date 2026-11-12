/*
 * Cloudflare Turnstile en el navegador (12-nov-2026). Lo usan el panel del informe de la industria
 * (/es/q-ready) y «Descargar mi informe» (las dos páginas de medición).
 *
 * Modo «managed» con apariencia «interaction-only»: casi siempre se resuelve solo y no se ve; si
 * Cloudflare duda, aparece una casilla (un clic como máximo). El token viaja con el formulario y
 * el Worker lo verifica antes de escribir (lib/turnstile.mjs). Aquí no se decide nada: sin token,
 * el formulario no se envía, y si se envía con uno malo el servidor dice que no.
 *
 * La clave del sitio es pública. En localhost se usa la clave de prueba que publica Cloudflare
 * (siempre pasa), para no depender del widget real al desarrollar.
 */
(() => {
  const CLAVE = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? "1x00000000000000000000AA" : "0x4AAAAAAF-M7uOMd5cdotwI";
  let carga = null;
  const cargar = () => carga || (carga = new Promise((ok, mal) => {
    if (window.turnstile) return ok(window.turnstile);
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true; s.onload = () => ok(window.turnstile); s.onerror = () => { carga = null; mal(new Error("turnstile no cargó")); };
    document.head.appendChild(s);
  }));

  /** Monta el widget en `caja` y devuelve { esperarToken(ms), reiniciar() }. */
  function montar(caja) {
    let id = null, token = null;
    const listo = cargar().then((ts) => {
      id = ts.render(caja, {
        sitekey: CLAVE, appearance: "interaction-only", size: "flexible",
        language: document.documentElement.lang === "en" ? "en" : "es",
        callback: (t) => { token = t; }, "expired-callback": () => { token = null; }, "error-callback": () => { token = null; },
      });
      return ts;
    });
    return {
      async esperarToken(ms = 12000) {
        try { await listo; } catch { return null; }
        const hasta = Date.now() + ms;
        while (!token && Date.now() < hasta) await new Promise((r) => setTimeout(r, 250));
        return token;
      },
      reiniciar() { token = null; listo.then((ts) => { if (id != null) ts.reset(id); }).catch(() => {}); },
    };
  }
  window.rqTurnstile = { montar };
})();
