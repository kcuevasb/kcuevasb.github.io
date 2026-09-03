/* Filtro de vista de la portada.
 *
 * Reordena y atenua; nunca oculta. Con cinco tarjetas que caben en una
 * pantalla, esconder dos pide un clic para ahorrar poco y deja a quien haya
 * filtrado sin ver el resto de la pagina. Atenuando, quien busca una cosa la
 * encuentra arriba y quien solo pasa la vista lo sigue teniendo todo delante.
 *
 * El orden se cambia MOVIENDO los nodos, no con `order` de CSS: con `order`
 * el foco del teclado sigue yendo por el orden del HTML y deja de coincidir
 * con lo que se ve, que es justo el fallo que documenta la WCAG. Moviendo los
 * nodos, orden visual, orden de lectura y orden de tabulacion son el mismo.
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

  var blocks = Array.prototype.slice.call(wrap.querySelectorAll('.cv-block'));
  if (blocks.length < 2) return;

  // Sin JavaScript la barra no haria nada, asi que llega oculta del servidor
  // y solo aparece si hemos llegado hasta aqui.
  bar.hidden = false;

  var quiet = window.matchMedia('(prefers-reduced-motion: reduce)');

  function apply(view, animate) {
    var before = null, i;
    if (animate) {
      before = [];
      for (i = 0; i < blocks.length; i++) {
        before.push(blocks[i].getBoundingClientRect().top);
      }
    }

    var chosen = [], rest = [];
    for (i = 0; i < blocks.length; i++) {
      var pick = (view === 'all' || blocks[i].dataset.group === view);
      (pick ? chosen : rest).push(blocks[i]);
      blocks[i].classList.toggle('is-muted', !pick);
    }
    var order = chosen.concat(rest);
    for (i = 0; i < order.length; i++) wrap.appendChild(order[i]);

    if (!animate) return;

    var moved = false;
    var deltas = [];
    for (i = 0; i < blocks.length; i++) {
      deltas.push(before[i] - blocks[i].getBoundingClientRect().top);
    }
    for (i = 0; i < blocks.length; i++) {
      if (!deltas[i]) continue;
      moved = true;
      blocks[i].style.transition = 'none';
      blocks[i].style.transform = 'translateY(' + deltas[i] + 'px)';
    }
    if (!moved) return;

    // Reflujo forzado: sin el, el navegador agrupa el "ponte donde estabas" y
    // el "vuelve a tu sitio" en un solo cambio y no se anima nada.
    void wrap.offsetWidth;

    for (i = 0; i < blocks.length; i++) {
      blocks[i].style.transition = '';
      blocks[i].style.transform = '';
    }
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
