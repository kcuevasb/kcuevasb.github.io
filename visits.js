/* Registro de visitas del easter egg del retrato (doble clic para voltearlo).
 *
 * Una fila por VISITA (sesion de pestaña), no por pagina vista: si dentro de
 * la misma sesion se navega fuera de la portada y se vuelve, no se registra
 * una fila nueva (sessionStorage guarda el token de la primera), pero el
 * numero mostrado sigue siendo el total real gracias a una funcion aparte de
 * solo lectura.
 *
 * Deliberadamente NO se manda IP ni el User-Agent completo: aislado, cada
 * campo de abajo no identifica a nadie, pero esa combinacion por fila si
 * seria fingerprinting. Ver "Contador de visitas" en CLAUDE.md antes de
 * anadir un campo mas aqui.
 *
 * La tabla en Supabase no tiene ninguna politica de RLS que la abra: la
 * clave anonima de aqui (es publica, viaja en el JS) solo puede ejecutar
 * tres funciones -- registrar una visita, leer el total, marcar la propia
 * visita como "volteada" -- nunca tocar la tabla directamente. El token que
 * identifica cada visita es un UUID, no el id secuencial de la fila: con un
 * id adivinable, marcar el volteo de la sesion propia habria dejado tocar
 * tambien la fila de cualquier otra.
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://kqsidslztbhjupqrnazw.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_mCstmoJZDJFXsLGyrEMkTg_2lyQ3XBX';

  var flip = document.getElementById('portrait-flip');
  var out = document.getElementById('visit-count');
  if (!flip || !out) return;

  var TOKEN_KEY = 'sv_token';
  var FLIPPED_KEY = 'sv_flipped';
  var visitToken = null;

  function call(fn, params) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params || {})
    }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    });
  }

  function storedToken() {
    try { return sessionStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }

  function fetchTotal() {
    var existing = storedToken();

    if (existing) {
      visitToken = existing;
      return call('read_visit_total')
        .then(function (n) { return typeof n === 'number' ? n : null; })
        .catch(function () { return null; });
    }

    // Cada campo es una pista suelta, no un identificador: idioma de la
    // portada, de donde vino, idioma y huso horario del navegador, y ancho
    // de ventana (no resolucion de pantalla completa, que dice mas de la
    // cuenta del monitor de quien visita).
    var params = {
      p_lang: document.documentElement.lang || 'es',
      p_referrer: document.referrer || null,
      p_browser_lang: (navigator.language || null),
      p_timezone: (function () {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; }
        catch (e) { return null; }
      })(),
      p_viewport_width: window.innerWidth || null
    };

    return call('log_visit', params)
      .then(function (rows) {
        var row = Array.isArray(rows) ? rows[0] : rows;
        if (!row) return null;
        visitToken = row.visit_token || null;
        try { if (visitToken) sessionStorage.setItem(TOKEN_KEY, visitToken); } catch (e) {}
        return typeof row.total === 'number' ? row.total : null;
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

  fetchTotal().then(render);

  function markFlipped() {
    var already = false;
    try { already = sessionStorage.getItem(FLIPPED_KEY) === '1'; } catch (e) {}
    if (already || !visitToken) return;
    try { sessionStorage.setItem(FLIPPED_KEY, '1'); } catch (e) {}
    call('mark_visit_flipped', { p_token: visitToken }).catch(function () {});
  }

  function toggle() {
    var flipped = flip.classList.toggle('is-flipped');
    flip.setAttribute('aria-pressed', flipped ? 'true' : 'false');
    if (flipped) markFlipped();
  }

  flip.addEventListener('dblclick', toggle);
  flip.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });
})();
