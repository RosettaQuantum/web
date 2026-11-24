/*
 * El carrusel de publicaciones del hero de /es/q-ready y /q-ready.
 * components/publicaciones/CarruselPublicaciones.astro pinta todas las diapositivas en la misma celda;
 * aquí se decide cuál se ve y, desde el 24-nov-2026, se la hace avanzar sola.
 *
 * NAVEGACIÓN. Pestañas (role="tab", tabindex móvil: ← → Inicio Fin dentro de la lista) y flechas. La
 * pestaña activa lleva aria-selected="true"; las diapositivas inactivas van con visibility:hidden (CSS).
 *
 * AVANCE SOLO (cada --pub-ms, 7 s). El reloj es la animación CSS de la barra de progreso de la pestaña
 * activa: cuando termina (animationend) se pasa a la siguiente. Así la barra y el cambio no pueden
 * desincronizarse, y pausar es pausar la animación.
 *  · Se DETIENE PARA SIEMPRE al primer clic, foco o tecla dentro del carrusel (salvo en el botón de pausa,
 *    que es el control de eso mismo). «Para siempre» = no se reanuda solo; el botón sí lo reanuda.
 *  · Se PAUSA con el mouse encima y sigue al salir.
 *  · No existe con prefers-reduced-motion: ni avance, ni barra, ni botón.
 *  · Mientras avanza solo, la pista va con aria-live="off" (anunciar cada 7 s sería ruido); detenido,
 *    vuelve a "polite" para anunciar la tarjeta que alguien eligió.
 *  · El botón de pausa (WCAG 2.2.2) cambia su nombre entre «Pausar» y «Reanudar» (data-pausar /
 *    data-reanudar del carrusel: textos provisorios en src/lib/carrusel-textos.mjs).
 *
 * Si el foco estaba DENTRO de la diapositiva que se oculta, pasa al control que se usó.
 */
(() => {
  const raiz = document.getElementById('pub-carrusel');
  if (!raiz) return;
  const diapos = [...raiz.querySelectorAll('.pub-diapo')];
  const tabs = [...raiz.querySelectorAll('.pub-pestana')];
  const pista = raiz.querySelector('.pub-pista');
  const pausa = raiz.querySelector('.pub-pausa');
  if (diapos.length < 2) return;
  let actual = Math.max(0, diapos.findIndex((d) => d.classList.contains('activa')));
  const reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ir(k, desde) {
    const n = diapos.length;
    const nuevo = ((k % n) + n) % n;
    if (nuevo === actual) return;
    const saliente = diapos[actual];
    const conFoco = saliente.contains(document.activeElement);
    saliente.classList.remove('activa');
    diapos[nuevo].classList.add('activa');
    tabs.forEach((t, i) => { t.setAttribute('aria-selected', i === nuevo ? 'true' : 'false'); t.tabIndex = i === nuevo ? 0 : -1; });
    actual = nuevo;
    if (conFoco && desde) desde.focus();
  }

  // ── el avance solo ──────────────────────────────────────────────────────────────────────────────
  let auto = false;
  const rotular = () => {
    if (!pausa) return;
    pausa.setAttribute('aria-label', auto ? raiz.dataset.pausar : raiz.dataset.reanudar);
    pausa.dataset.estado = auto ? 'avanza' : 'detenido';
  };
  function arrancar() {
    if (reducido) return;
    auto = true; raiz.classList.add('auto'); raiz.classList.remove('pausa');
    pista.setAttribute('aria-live', 'off'); rotular();
  }
  function detener() {
    if (!auto) return;
    auto = false; raiz.classList.remove('auto', 'pausa');
    pista.setAttribute('aria-live', 'polite'); rotular();
  }
  raiz.addEventListener('animationend', (e) => {
    if (auto && e.animationName === 'pub-avance' && e.target.closest('.pub-pestana') === tabs[actual]) ir(actual + 1);
  });
  raiz.addEventListener('mouseenter', () => { if (auto) raiz.classList.add('pausa'); });
  raiz.addEventListener('mouseleave', () => raiz.classList.remove('pausa'));
  // Cualquier clic, foco o tecla dentro del carrusel (que no sea en el botón de pausa) lo detiene para siempre.
  const esPausa = (t) => pausa && (t === pausa || pausa.contains(t));
  ['pointerdown', 'focusin', 'keydown'].forEach((ev) => raiz.addEventListener(ev, (e) => { if (!esPausa(e.target)) detener(); }));
  if (pausa) {
    pausa.addEventListener('click', () => (auto ? detener() : arrancar()));
    if (!reducido) pausa.hidden = false;
  }

  // ── navegación ──────────────────────────────────────────────────────────────────────────────────
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('[data-paso],[data-ir]');
    if (!b || !raiz.contains(b)) return;
    if (b.dataset.paso) ir(actual + Number(b.dataset.paso), b);
    else ir(Number(b.dataset.ir), b);
  });
  raiz.querySelector('.pub-pestanas')?.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: actual - 1, ArrowRight: actual + 1, Home: 0, End: diapos.length - 1 }[e.key];
    if (k === undefined) return;
    e.preventDefault();
    ir(k);
    tabs[actual].focus();
  });
  raiz.querySelector('.pub-controles')?.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    ir(actual + (e.key === 'ArrowRight' ? 1 : -1));
  });

  arrancar();
})();
