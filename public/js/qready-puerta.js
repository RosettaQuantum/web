/*
 * /es/q-ready y /q-ready — el pop-up y el formulario del informe individual. 15-sep-2026.
 *
 * 23-nov-2026: la portada sirve a los dos idiomas. Los mensajes del formulario individual llegan en
 * `data-textos` del velo (src/lib/puerta-textos.mjs → js), con el idioma y la ruta de origen; si el
 * atributo faltara, quedan los de siempre en español. El formulario del informe (más abajo) existe
 * sólo en español y no cambia.
 *
 * TRES REGLAS QUE SALIERON DE REVISAR LA MAQUETA, cada una por un defecto real:
 *  1. El diálogo se oculta con el atributo `hidden` y la hoja declara [hidden]{display:none
 *     !important}. Sin eso, `.qr-velo{display:grid}` le ganaba y el pop-up quedaba ABIERTO
 *     desde la carga, sin forma de cerrarlo.
 *  2. Si el diálogo se abre solo, el foco va al diálogo y no a un campo: en un teléfono,
 *     enfocar un campo levanta el teclado sin que nadie lo haya pedido.
 *  3. «Recibido» se muestra SÓLO si /api/qready-lead responde ok. Ese endpoint escribe la
 *     fila en D1 antes de avisar por correo; confirmar antes de su respuesta sería la promesa
 *     falsa que ese mismo endpoint nació para eliminar.
 */
(() => {
  const velo = document.getElementById('qr-velo');
  if (!velo) return;
  const dialogo = velo.querySelector('.qr-dialogo');
  const publico = velo.dataset.publico === '1';
  const ES = { faltan: 'Faltan campos por completar.', dominio: 'El correo tiene que ser del dominio ‹dominio›.',
    dominioSin: 'El correo tiene que ser del dominio que indicó.', enviando: 'Enviando…',
    recibido: 'Recibido. Le escribiremos a ese correo para coordinar su informe.',
    noRegistro: 'No pudimos registrar su pedido. Escríbanos a hello@rosettaquantum.com.',
    noConecta: 'No pudimos conectar. Escríbanos a hello@rosettaquantum.com.' };
  let TX = ES;
  try { TX = { ...ES, ...JSON.parse(velo.dataset.textos || '{}') }; } catch { /* quedan los de siempre */ }
  const LANG = velo.dataset.lang === 'en' ? 'en' : 'es';
  const ORIGEN = velo.dataset.origen || '/es/q-ready';
  let antes = null, visto = false;
  const leer = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };
  const guardar = (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* sin almacenamiento: da igual */ } };

  function abrir(foco, sola = false) {
    antes = document.activeElement; velo.hidden = false; visto = true; guardar('qr-popup', '1');
    const f = velo.querySelector(`[data-op="${foco}"] input`);
    (sola || !f ? dialogo : f).focus({ preventScroll: true });
    const tarjeta = velo.querySelector(`[data-op="${foco}"]`);
    dialogo.scrollTop = !sola && tarjeta ? Math.max(0, tarjeta.offsetTop - 12) : 0;
  }
  function cerrar() { velo.hidden = true; if (antes && antes.focus) antes.focus(); }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-abrir]');
    if (b) { abrir(b.dataset.abrir); return; }
    if (e.target.closest('[data-cerrar]') || e.target === velo) cerrar();
  });
  document.addEventListener('keydown', (e) => {
    if (velo.hidden) return;
    if (e.key === 'Escape') cerrar();
    if (e.key === 'Tab') {
      const f = [...dialogo.querySelectorAll('button,input')].filter((x) => x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  // Apertura sola: sólo con el informe público, cuando el lector terminó de ver las cifras.
  // Una vez por visita, nunca al cargar.
  const fin = document.querySelector('#cifras .qr-acciones');
  if (publico && fin && 'IntersectionObserver' in window) {
    new IntersectionObserver((es, obs) => {
      if (es.some((x) => x.isIntersecting) && !visto && !leer('qr-popup')) {
        obs.disconnect(); setTimeout(() => abrir('informe', true), 900);
      }
    }, { threshold: 1 }).observe(fin);
  }

  const dominioDe = (s) => String(s || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[\/?#].*$/, '');
  const decir = (form, texto, ok) => {
    const p = form.querySelector('.qr-estado');
    p.textContent = texto; p.hidden = false; p.classList.toggle('qr-bien', !!ok);
  };

  velo.querySelectorAll('.qr-op').forEach((form) => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let ok = true;
    form.querySelectorAll('input[required]').forEach((i) => {
      const bien = i.type === 'checkbox' ? i.checked : i.checkValidity() && i.value.trim() !== '';
      i.setAttribute('aria-invalid', bien ? 'false' : 'true');
      if (!bien && ok) { i.focus(); ok = false; }
    });
    if (!ok) { decir(form, TX.faltan); return; }

    const boton = form.querySelector('button[type=submit]');
    const datos = Object.fromEntries(new FormData(form));

    if (form.dataset.op === 'individual') {
      // La casilla promete que mide quien representa a la organización, con un correo de
      // su dominio. Se exige aquí para que la promesa no sea sólo texto.
      const dom = dominioDe(datos.dominio);
      const delCorreo = String(datos.email).split('@')[1]?.toLowerCase() || '';
      if (!dom || !(delCorreo === dom || delCorreo.endsWith('.' + dom))) {
        const i = form.querySelector('[name=email]'); i.setAttribute('aria-invalid', 'true'); i.focus();
        decir(form, dom ? TX.dominio.replace('‹dominio›', dom) : TX.dominioSin);
        return;
      }
      boton.disabled = true; decir(form, TX.enviando);
      try {
        const r = await fetch('/api/qready-lead', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            legal: datos.legal, name: datos.name, email: datos.email, lang: LANG, tier: 'scan-individual',
            notes: `Dominio: ${dom} · Autoriza medir su superficie pública: sí · Origen: ${ORIGEN}`,
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.ok) {
          decir(form, TX.recibido, true);
          form.querySelectorAll('input').forEach((i) => { i.disabled = true; });
          return;
        }
        decir(form, TX.noRegistro);
      } catch {
        decir(form, TX.noConecta);
      }
      boton.disabled = false;
      return;
    }

    // Tarjeta del informe: sólo existe con INFORME_PUBLICO. Antes de encenderla hay que dar de
    // alta la lista 'informe-pqc' en /api/subscribe, que hoy acepta sólo monitor y weekly y
    // responde 400 a cualquier otra. El error se muestra: nunca se confirma algo no guardado.
    boton.disabled = true; decir(form, 'Enviando…');
    try {
      const r = await fetch('/api/subscribe', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: datos.email, lista: 'informe-pqc', origen: datos.proxima ? 'q-ready+proxima' : 'q-ready' }),
      });
      if (r.ok) { decir(form, 'Listo. Le llegará a ese correo.', true); return; }
      decir(form, 'No pudimos registrar su correo. Escríbanos a hello@rosettaquantum.com.');
    } catch {
      decir(form, 'No pudimos conectar. Escríbanos a hello@rosettaquantum.com.');
    }
    boton.disabled = false;
  }));
})();

/*
 * El panel del informe de la industria (12-nov-2026): correo + Turnstile → /api/qready/informe-industria.
 * Igual que el formulario individual: el enlace al informe aparece SÓLO cuando el endpoint confirma
 * que la fila quedó escrita. Sin token de Turnstile no se envía; el servidor lo vuelve a exigir.
 */
(() => {
  const form = document.getElementById('qr-informe-form');
  if (!form) return;
  const est = form.querySelector('.qr-estado');
  const decir = (html, ok) => { est.innerHTML = html; est.hidden = false; est.classList.toggle('qr-bien', !!ok); };
  const ts = window.rqTurnstile ? window.rqTurnstile.montar(form.querySelector('[data-turnstile]')) : null;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.querySelector('[name=email]');
    const bien = email.checkValidity() && email.value.trim() !== '';
    email.setAttribute('aria-invalid', bien ? 'false' : 'true');
    if (!bien) { email.focus(); decir('Escriba un correo válido.'); return; }
    const boton = form.querySelector('button[type=submit]');
    boton.disabled = true; decir('Verificando…');
    const token = ts ? await ts.esperarToken() : null;
    if (!token) { decir('No pudimos verificar que es una persona. Recargue la página e intente de nuevo.'); boton.disabled = false; return; }
    try {
      const r = await fetch('/api/qready/informe-industria', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.value.trim(), edicion: form.dataset.edicion, proxima: form.querySelector('[name=proxima]').checked, turnstile: token, lang: 'es' }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        decir('Listo. <a href="/informe-pqc">Abrir el informe →</a>', true);
        form.querySelectorAll('input').forEach((i) => { i.disabled = true; });
        return;
      }
      decir(j.error ? String(j.error).replace(/[<>&]/g, '') : 'No pudimos registrar su correo. Escríbanos a hello@rosettaquantum.com.');
    } catch {
      decir('No pudimos conectar. Escríbanos a hello@rosettaquantum.com.');
    }
    if (ts) ts.reiniciar();
    boton.disabled = false;
  });
})();
