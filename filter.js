/* Filtro de vista de la portada.
 *
 * Cuatro vistas: todo, experiencia laboral, fuera del trabajo y cronologia.
 * Las tres primeras muestran y ocultan bloques enteros. La cuarta es distinta:
 * rompe la agrupacion por bloques y pone las cinco tarjetas seguidas, del 01
 * al 05, que es el orden en que pasaron las cosas.
 *
 * La cronologia MUEVE las tarjetas a otra lista en vez de duplicarlas, asi que
 * cada una guarda de donde viene. Al volver no se reinsertan una a una con
 * insertBefore (el hermano que se guardo puede haberse movido tambien): se
 * reconstruye cada lista de golpe, que ademas es lo unico que garantiza el
 * orden original.
 *
 * La animacion es FLIP: se mide donde estaba cada bloque, se cambia el DOM, se
 * mide donde ha quedado, se le aplica la diferencia como transformacion y se
 * suelta. Es lo unico que anima un reflujo sin animar `top` ni `height`, que
 * son propiedades que obligan a recalcular la pagina en cada fotograma.
 */
(function () {
  'use strict';

  var bar = document.querySelector('.view-filter');
  var wrap = document.querySelector('.chapters');
  if (!bar || !wrap) return;

  var blocks = [].slice.call(wrap.querySelectorAll('.cv-block'));
  var strip = wrap.querySelector('.entries-timeline');
  var cards = [].slice.call(wrap.querySelectorAll('.entries > li[data-order]'));
  if (!blocks.length || !strip || !cards.length) return;

  // De donde sale cada tarjeta, agrupado por lista, para poder devolverlas.
  var homes = [];
  cards.forEach(function (li) {
    var list = li.parentNode, slot = null, i;
    for (i = 0; i < homes.length; i++) if (homes[i].list === list) slot = homes[i];
    if (!slot) { slot = { list: list, items: [] }; homes.push(slot); }
    slot.items.push(li);
  });

  var byDate = cards.slice().sort(function (a, b) {
    return (+a.dataset.order) - (+b.dataset.order);
  });

  // Sin JavaScript la barra no haria nada, asi que llega oculta del servidor
  // y solo aparece si hemos llegado hasta aqui.
  bar.hidden = false;

  var quiet = window.matchMedia('(prefers-reduced-motion: reduce)');

  function shows(block, view) {
    var g = block.dataset.group;
    if (view === 'cron') return g === 'timeline';
    if (g === 'timeline') return false;
    return view === 'all' || g === view;
  }

  function apply(view, animate) {
    var before = null;
    if (animate) {
      before = blocks.map(function (b) {
        return b.hidden ? null : b.getBoundingClientRect().top;
      });
    }

    if (view === 'cron') {
      byDate.forEach(function (li) { strip.appendChild(li); });
    } else {
      homes.forEach(function (slot) {
        slot.items.forEach(function (li) { slot.list.appendChild(li); });
      });
    }

    blocks.forEach(function (b) { b.hidden = !shows(b, view); });

    if (!animate) return;

    var moved = false;
    blocks.forEach(function (b, i) {
      if (b.hidden) return;
      if (before[i] === null) {
        // Bloque que no estaba: entra desde abajo y transparente.
        b.style.transition = 'none';
        b.style.opacity = '0';
        b.style.transform = 'translateY(12px)';
        moved = true;
        return;
      }
      var dy = before[i] - b.getBoundingClientRect().top;
      if (!dy) return;
      b.style.transition = 'none';
      b.style.transform = 'translateY(' + dy + 'px)';
      moved = true;
    });
    if (!moved) return;

    // Reflujo forzado: sin el, el navegador agrupa el "ponte donde estabas" y
    // el "vuelve a tu sitio" en un solo cambio y no se anima nada.
    void wrap.offsetWidth;

    blocks.forEach(function (b) {
      b.style.transition = '';
      b.style.transform = '';
      b.style.opacity = '';
    });
  }

  bar.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || t.name !== 'view') return;
    apply(t.value, !quiet.matches);
  });

  // Firefox recuerda que radio estaba marcado al recargar, asi que el estado
  // de partida se lee del DOM en vez de darlo por hecho.
  var start = bar.querySelector('input[name="view"]:checked');
  apply(start ? start.value : 'all', false);
})();
