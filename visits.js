/* Contador de visitas del easter egg del retrato (doble clic para voltearlo).
 *
 * Una llamada por SESION de pestaña, no por pagina vista: si dentro de la
 * misma sesion se navega fuera de la portada y se vuelve, no se vuelve a
 * sumar (sessionStorage), pero el numero mostrado sigue siendo el actual
 * gracias a una segunda funcion de solo lectura.
 *
 * La tabla en Supabase NO tiene ninguna politica de RLS que la abra: la
 * clave anonima de aqui solo puede ejecutar dos funciones (sumar 1 y
 * devolver el total | leer el total), nunca tocar la tabla directamente.
 * Aun asi, cualquiera con esta clave (es publica, viaja en el JS) puede
 * llamar a la de sumar en bucle e inflar el numero -- es la misma
 * limitacion de cualquier contador de visitas publico, no es un fallo de
 * esta implementacion.
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
  var SUPABASE_ANON_KEY = 'TU-CLAVE-ANONIMA';

  var flip = document.getElementById('portrait-flip');
  var out = document.getElementById('visit-count');
  if (!flip || !out) return;

  var SESSION_KEY = 'sv';

  function call(fn) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: '{}'
    }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    });
  }

  function fetchCount() {
    var already = false;
    try { already = sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) {}

    return call(already ? 'read_site_visits' : 'bump_site_visits')
      .then(function (n) {
        try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}
        return typeof n === 'number' ? n : null;
      })
      .catch(function () { return null; });
  }

  function render(n) {
    if (n == null) { out.textContent = '—'; return; }
    var loc = document.documentElement.lang || 'es';
    var formatted;
    try { formatted = new Intl.NumberFormat(loc).format(n); }
    catch (e) { formatted = String(n); }
    out.textContent = formatted;
  }

  fetchCount().then(render);

  function toggle() {
    var flipped = flip.classList.toggle('is-flipped');
    flip.setAttribute('aria-pressed', flipped ? 'true' : 'false');
  }

  flip.addEventListener('dblclick', toggle);
  flip.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });
})();
