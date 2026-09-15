/*
 * /es/q-ready — el pop-up y el formulario del informe individual. 15-sep-2026.
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
    if (!ok) { decir(form, 'Faltan campos por completar.'); return; }

    const boton = form.querySelector('button[type=submit]');
    const datos = Object.fromEntries(new FormData(form));

    if (form.dataset.op === 'individual') {
      // La casilla promete que mide quien representa a la organización, con un correo de
      // su dominio. Se exige aquí para que la promesa no sea sólo texto.
      const dom = dominioDe(datos.dominio);
      const delCorreo = String(datos.email).split('@')[1]?.toLowerCase() || '';
      if (!dom || !(delCorreo === dom || delCorreo.endsWith('.' + dom))) {
        const i = form.querySelector('[name=email]'); i.setAttribute('aria-invalid', 'true'); i.focus();
        decir(form, `El correo tiene que ser del dominio ${dom || 'que indicó'}.`);
        return;
      }
      boton.disabled = true; decir(form, 'Enviando…');
      try {
        const r = await fetch('/api/qready-lead', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            legal: datos.legal, name: datos.name, email: datos.email, lang: 'es', tier: 'scan-individual',
            notes: `Dominio: ${dom} · Autoriza medir su superficie pública: sí · Origen: /es/q-ready`,
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.ok) {
          decir(form, 'Recibido. Le escribiremos a ese correo para coordinar su informe.', true);
          form.querySelectorAll('input').forEach((i) => { i.disabled = true; });
          return;
        }
        decir(form, 'No pudimos registrar su pedido. Escríbanos a hello@rosettaquantum.com.');
      } catch {
        decir(form, 'No pudimos conectar. Escríbanos a hello@rosettaquantum.com.');
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
