/* La barra fina del informe: dice en que seccion va el lector y abre las trece.
 *
 * Lo que hace y lo que NO. La barra se muestra y se esconde SOLA por CSS —es sticky y va
 * despues del indice en el DOM—, y se abre y se cierra sola porque es un <details>. Sin
 * este archivo la barra sigue sirviendo: muestra la seccion 01 y la lista abre igual. Lo
 * unico que agrega el script es que la etiqueta siga al lector, y cerrar al elegir.
 * Por eso cada paso sale si no encuentra lo suyo, en vez de dejar la pagina a medias.
 *
 * El umbral son 120 px: la barra del sitio (60) mas la fina (38) mas un respiro. Una
 * seccion cuenta como «la actual» cuando su borde superior ya paso por debajo de las dos
 * barras, que es cuando el lector la esta leyendo de verdad. (5-nov-2026) */
(function () {
  var barra = document.getElementById('tocbar');
  if (!barra) return;
  var casilla = barra.querySelector('.tb-n');
  var titulo = barra.querySelector('.tb-t');
  var enlaces = Array.prototype.slice.call(barra.querySelectorAll('.tb-lista a'));
  if (!casilla || !titulo || !enlaces.length) return;

  // La lista manda: cada entrada busca SU seccion por el ancla que ya lleva escrita. Si
  // una no existe en el documento, se cae de la lista en vez de apuntar al vacio.
  var secciones = enlaces.map(function (a) {
    var href = a.getAttribute('href') || '';
    return {
      a: a,
      n: a.getAttribute('data-n') || '',
      t: a.lastElementChild ? a.lastElementChild.textContent : '',
      el: href.charAt(0) === '#' ? document.getElementById(href.slice(1)) : null
    };
  }).filter(function (s) { return s.el; });
  if (!secciones.length) return;

  var UMBRAL = 120;
  var actual = -1;

  function pintar() {
    var i = 0;
    for (var k = 0; k < secciones.length; k++) {
      if (secciones[k].el.getBoundingClientRect().top <= UMBRAL) i = k;
    }
    if (i === actual) return;
    actual = i;
    casilla.textContent = secciones[i].n;
    titulo.textContent = secciones[i].t;
    for (var j = 0; j < secciones.length; j++) {
      if (j === i) secciones[j].a.setAttribute('aria-current', 'true');
      else secciones[j].a.removeAttribute('aria-current');
    }
  }

  var pedido = false;
  function alDesplazar() {
    if (pedido) return;
    pedido = true;
    requestAnimationFrame(function () { pedido = false; pintar(); });
  }

  addEventListener('scroll', alDesplazar, { passive: true });
  addEventListener('resize', alDesplazar);
  pintar();

  // Cerrar: al elegir una seccion, al tocar fuera, y con Escape.
  barra.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.tb-lista a')) barra.open = false;
  });
  document.addEventListener('click', function (e) {
    if (barra.open && !barra.contains(e.target)) barra.open = false;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && barra.open) barra.open = false;
  });
})();
