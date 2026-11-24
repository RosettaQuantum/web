/*
 * El carrusel de publicaciones del hero de /es/q-ready y /q-ready (23-nov-2026).
 * components/publicaciones/CarruselPublicaciones.astro pinta todas las diapositivas en la misma celda;
 * aquí sólo se decide cuál se ve. No rota solo: cambia cuando alguien lo pide.
 *
 *  · Flechas (data-paso) y puntos (data-ir). ← y → con el foco en los controles.
 *  · El punto activo lleva aria-current="true"; las demás diapositivas van con visibility:hidden (CSS),
 *    que las saca del orden de tabulación y de lo que lee un lector de pantalla.
 *  · La pista es aria-live="polite": la tarjeta nueva se anuncia sin robar el foco.
 *  · Si el foco estaba DENTRO de la diapositiva que se oculta (p. ej. en el correo del informe), pasa
 *    al control que se usó, para que no quede en un elemento invisible.
 */
(() => {
  const raiz = document.getElementById('pub-carrusel');
  if (!raiz) return;
  const diapos = [...raiz.querySelectorAll('.pub-diapo')];
  const puntos = [...raiz.querySelectorAll('.pub-punto')];
  if (diapos.length < 2) return;
  let actual = Math.max(0, diapos.findIndex((d) => d.classList.contains('activa')));

  function ir(k, desde) {
    const n = diapos.length;
    const nuevo = ((k % n) + n) % n;
    if (nuevo === actual) return;
    const saliente = diapos[actual];
    const conFoco = saliente.contains(document.activeElement);
    saliente.classList.remove('activa');
    diapos[nuevo].classList.add('activa');
    puntos.forEach((p, i) => p.setAttribute('aria-current', i === nuevo ? 'true' : 'false'));
    actual = nuevo;
    if (conFoco && desde) desde.focus();
  }

  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('[data-paso],[data-ir]');
    if (!b || !raiz.contains(b)) return;
    if (b.dataset.paso) ir(actual + Number(b.dataset.paso), b);
    else ir(Number(b.dataset.ir), b);
  });
  raiz.querySelector('.pub-controles')?.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    ir(actual + (e.key === 'ArrowRight' ? 1 : -1));
    const p = puntos[actual];
    if (p && document.activeElement && document.activeElement.classList.contains('pub-punto')) p.focus();
  });
})();
