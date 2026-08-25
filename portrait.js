'use strict';
/* Retrato en lluvia de Matrix.

   La referencia es el plano de Neo mirando el codigo: el fondo es lluvia
   verde apagada y la figura es LA MISMA lluvia, pero mas brillante. Es
   decir, lo que dibuja la cara no son los glifos — todos son katakana al
   azar y van cambiando — sino cuanto brilla cada celda. Por eso esto es un
   canvas y no un <pre>: hace falta modular tono y brillo celda a celda.

   El mismo retrato en ASCII estatico queda como respaldo dentro de un
   <noscript>, para quien navegue sin JS. */
(function(){
  const cv = document.getElementById('portrait-rain');
  if (!cv || !cv.getContext) return;
  const pre = document.getElementById('ascii-portrait');
  const ctx = cv.getContext('2d');

  /* La rejilla marca el detalle del retrato, pero no se puede mirar sola:
     el glifo se dibuja al ancho de celda y por debajo de unos 5px los
     katakana se empastan y dejan de leerse como glifos. Con 58 columnas en
     un retrato de 272px la celda queda en 4.7px, que estaria justo por
     debajo — por eso resize() dibuja siempre al doble de resolucion como
     minimo, y el glifo acaba saliendo a 9.4 pixeles de dispositivo.

     La proporcion COLS/ROWS se mantiene en 1.29 para que la celda conserve
     su forma; si se cambia una hay que cambiar la otra. */
  const COLS = 58, ROWS = 45;
  const SHADES = 32;      // niveles de color (se agrupa el dibujo por color)
  const TRAIL = 15;       // celdas de estela por gota
  const MUTATE = 63;      // celdas que cambian de glifo por frame
  const FRAME_MS = 1000 / 24;

  const GLYPHS = (() => {
    const a = [];
    for (let c = 0x30A2; c <= 0x30F3; c++) a.push(String.fromCharCode(c));
    for (let d = 0; d <= 9; d++) a.push(String(d));
    return a;
  })();

  /* Rampa construida sobre #00ff41 = rgb(0,255,65), que es la variable
     --green del capitulo de Matrix y el color de sus titulos: el retrato
     usa el mismo verde que el resto del sitio en vez de uno inventado.

     Dos numeros mandan y conviene respetarlos al tocar la rampa:
       - El rojo se queda en 0. Cualquier rojo desatura y tira a oliva.
       - La proporcion azul/verde se mantiene en ~0.25, la del tono de
         referencia. Subirla aclara hacia menta y el verde deja de ser
         electrico: se probo con 0.57 y salia pastel, muy lejos del original.

     El tono exacto cae en 0.85 y no en el tope, porque el 1.00 tiene que
     dejar sitio a las luces; aun asi el remate se queda en verde claro y no
     en blanco, o la cara — que tiene mucha celda en la parte alta — se
     leeria descolorida.

     Y ojo con el RECORRIDO: si los tramos medios suben mas que el techo, el
     rango se comprime y la cara se aplana. Paso al aclarar, y no se arregla
     desde la mascara — tocar el realce local o el contraste de la figura no
     movia nada, porque buena parte de la cara ya esta pegada al techo (esos
     parametros viven ahora en el generador de la mascara, no aqui).

     Aqui el techo lo fija el tono de referencia, que es mas oscuro que un
     blanco, asi que el recorrido se gana OSCURECIENDO la parte baja y no
     aclarando la alta: aclarar el tope romperia la coincidencia de color, que
     es justo lo que se buscaba. */
  const STOPS = [
    [  0.00, [  0,  24,   6]],
    [  0.30, [  0,  92,  23]],
    [  0.62, [  0, 182,  46]],
    [  0.85, [  0, 255,  65]],
    [  1.00, [150, 255, 175]]
  ];
  function shade(t){
    for (let i = 1; i < STOPS.length; i++){
      if (t <= STOPS[i][0]){
        const t0 = STOPS[i-1][0], c0 = STOPS[i-1][1];
        const t1 = STOPS[i][0],   c1 = STOPS[i][1];
        const k = (t - t0) / (t1 - t0);
        return 'rgb(' + c0.map((v, j) => Math.round(v + (c1[j] - v) * k)).join(',') + ')';
      }
    }
    return 'rgb(200,255,214)';
  }
  const PALETTE = Array.from({ length: SHADES }, (_, i) => shade(i / (SHADES - 1)));

  let mask = null;                 // intensidad 0..1 por celda
  const glyph = new Array(COLS * ROWS).fill(0);
  const base = document.createElement('canvas');
  let cellW = 0, cellH = 0, dpr = 1;
  // Una sola definicion: la usan la capa base, la mutacion y las gotas.
  const cellFont = () => cellW.toFixed(2) + 'px "M PLUS 1 Code", "MS Gothic", monospace';
  let drops = [];
  let raf = 0, lastFrame = 0, running = false;

  /* Erosion o dilatacion con elemento cuadrado, en dos pasadas 1D en vez de
     una 2D: para radio 3 son 14 lecturas por pixel en lugar de 49. */

  /* --- mascara del retrato ---------------------------------------------

     Separar figura de fondo aqui tiene tres trampas, y se pisaron las tres
     antes de dar con esto:

     1. Un umbral de brillo no vale: la cara esta bien iluminada, su
        luminancia es tan alta como la del fondo de estudio y el umbral se
        comia media cara.
     2. Un relleno por region desde los bordes tampoco: el fondo tiene
        bandas horizontales, el relleno no puede cruzarlas, y todo el fondo
        por debajo quedaba desconectado de la semilla y contado como figura.
     3. Medir la distancia al fondo si funciona para el CONTORNO, pero deja
        la cara agujereada: donde la piel esta mas iluminada se parece tanto
        al fondo que esas celdas se caian del retrato.

     La salida de la 3 es no preguntarse celda a celda si algo es figura,
     sino que es FONDO: fondo es lo que se alcanza desde el borde de la
     imagen sin cruzar el contorno. Todo lo que queda encerrado dentro es
     cara, por poco que se distinga. Asi la silueta sale maciza y el brillo
     de dentro puede seguir la luz real de la foto sin abrir huecos. */


  /* --- capa base: el retrato en glifos --------------------------------- */
  function rebuild(){
    if (!mask || !cellW) return;
    for (let i = 0; i < glyph.length; i++)
      glyph[i] = (Math.random() * GLYPHS.length) | 0;

    const b = base.getContext('2d');
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.clearRect(0, 0, COLS * cellW, ROWS * cellH);
    b.font = cellFont();
    b.textAlign = 'center';
    b.textBaseline = 'middle';

    /* Agrupado por color: cambiar fillStyle 1656 veces por reconstruccion
       es lo unico caro de todo esto, y con 24 tonos basta. */
    const byShade = Array.from({ length: SHADES }, () => []);
    for (let i = 0; i < mask.length; i++)
      byShade[Math.round(mask[i] * (SHADES - 1))].push(i);

    for (let s = 0; s < SHADES; s++){
      if (!byShade[s].length) continue;
      b.fillStyle = PALETTE[s];
      for (const i of byShade[s]){
        const x = i % COLS, y = (i / COLS) | 0;
        b.fillText(GLYPHS[glyph[i]], (x + 0.5) * cellW, (y + 0.5) * cellH);
      }
    }
  }

  const shadeOf = i => PALETTE[Math.round(mask[i] * (SHADES - 1))];

  /* Cambia unas pocas celdas por frame en vez de rehacer la rejilla entera
     cada X ms. Renovarlas todas a la vez daba un parpadeo global, no el
     titileo continuo de la lluvia; y repintar solo las celdas tocadas es
     ademas mucho mas barato que las 1656 de la rejilla completa. */
  function mutate(count){
    if (!mask || !cellW) return;
    const b = base.getContext('2d');
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.font = cellFont();
    b.textAlign = 'center';
    b.textBaseline = 'middle';
    for (let k = 0; k < count; k++){
      const i = (Math.random() * mask.length) | 0;
      const x = i % COLS, y = (i / COLS) | 0;
      glyph[i] = (Math.random() * GLYPHS.length) | 0;
      b.clearRect(x * cellW, y * cellH, cellW, cellH);
      b.fillStyle = shadeOf(i);
      b.fillText(GLYPHS[glyph[i]], (x + 0.5) * cellW, (y + 0.5) * cellH);
    }
  }

  /* --- gotas ------------------------------------------------------------ */
  function seedDrops(){
    drops = Array.from({ length: COLS }, () => ({
      y: -Math.random() * ROWS * 1.5,
      // Lento a proposito: la lluvia acompaña al retrato, no compite con el.
      v: 5 + Math.random() * 6
    }));
  }

  /* Vuelca la capa base al canvas visible. Vive aparte de draw() porque el
     retrato tambien tiene que pintarse cuando NO hay animacion: con
     prefers-reduced-motion no se programa ni un rAF, y si el unico sitio
     que pintase fuese el bucle, esos usuarios se quedarian con el canvas en
     blanco — el fallo contrario al que se pretendia evitar. */
  function blit(){
    if (!cellW) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, COLS * cellW, ROWS * cellH);
    ctx.drawImage(base, 0, 0, COLS * cellW, ROWS * cellH);
  }

  function draw(now){
    raf = requestAnimationFrame(draw);
    if (now - lastFrame < FRAME_MS) return;
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;

    mutate(MUTATE);

    blit();

    ctx.save();
    // 'lighter' suma luz sobre lo que ya hay, que es justo lo que hace una
    // gota al pasar por delante de la figura: la enciende, no la tapa.
    ctx.globalCompositeOperation = 'lighter';
    ctx.font = cellFont();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let x = 0; x < COLS; x++){
      const d = drops[x];
      d.y += d.v * dt;
      if (d.y - TRAIL > ROWS){ d.y = -Math.random() * ROWS * 0.6; d.v = 5 + Math.random() * 6; }
      const head = Math.floor(d.y);
      for (let k = 0; k < TRAIL; k++){
        const y = head - k;
        if (y < 0 || y >= ROWS) continue;
        const i = y * COLS + x;
        const fade = 1 - k / TRAIL;
        /* La gota tambien se modula con el retrato: cae tenue sobre el
           fondo y se enciende al pasar por delante de la figura. Sin esto
           la lluvia reparte la misma luz por todo el cuadro y aplana la
           cara, que es justo lo que separa el plano de Neo de un fondo de
           Matrix cualquiera. */
        const lit = 0.20 + 0.80 * mask[i];
        const a = fade * fade * (k === 0 ? 0.95 : 0.5) * lit;
        ctx.fillStyle = k === 0
          ? 'rgba(170,255,192,' + a.toFixed(3) + ')'
          : 'rgba(0,255,65,' + a.toFixed(3) + ')';
        ctx.fillText(GLYPHS[glyph[i]], (x + 0.5) * cellW, (y + 0.5) * cellH);
      }
    }
    ctx.restore();
  }

  /* --- ciclo de vida ---------------------------------------------------- */
  function resize(){
    const w = cv.clientWidth;
    if (!w) return;
    /* Suelo de 2, no solo techo. El retrato mide 272px y con 58 columnas la
       celda cae a 4.7px, por debajo del umbral en que los katakana se
       empastan. Dibujando siempre al doble, el glifo sale a 9.4 pixeles de
       dispositivo aunque la pantalla sea de densidad 1, y asi se puede
       tener el retrato pequeño sin perder ni detalle ni nitidez. */
    dpr = Math.max(2, Math.min(3, window.devicePixelRatio || 1));
    cellW = w / COLS;
    cellH = w / ROWS;   // el recorte es cuadrado, asi que el canvas tambien
    cv.width  = Math.round(COLS * cellW * dpr);
    cv.height = Math.round(ROWS * cellH * dpr);
    base.width  = cv.width;
    base.height = cv.height;
    cv.style.height = (ROWS * cellH) + 'px';
    rebuild();
    blit();
  }

  function start(){
    if (running) return;
    running = true; lastFrame = performance.now();
    raf = requestAnimationFrame(draw);
  }
  function stop(){ running = false; cancelAnimationFrame(raf); }

  /* La mascara viene precalculada en portrait-mask.js. El analisis de la foto
     (buildMask, ~390 lineas) se ejecuta UNA VEZ en local y aqui solo se
     decodifica el resultado: 58x45 celdas, 16 bits de brillo por celda. Asi ni
     el algoritmo ni la foto se publican — antes ambos se servian enteros y
     cualquiera podia descargarlos. Para regenerarla, ver CLAUDE.md. */
  mask = (() => {
    const b64 = window.__PORTRAIT_MASK;
    if (!b64) return null;
    const bin = atob(b64);
    const m = new Float32Array(COLS * ROWS);
    for (let i = 0; i < m.length; i++)
      m[i] = ((bin.charCodeAt(i * 2) << 8) | bin.charCodeAt(i * 2 + 1)) / 65535;
    return m;
  })();
  // Sin mascara no hay retrato: se deja el respaldo ASCII del <noscript>.
  if (!mask) return;

  const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
  fonts.then(() => {
    // El respaldo ASCII vive dentro de <noscript>, asi que con JS activo ni
    // siquiera esta en el DOM y esto es null. Se comprueba por si algun dia
    // vuelve a sacarse fuera.
    if (pre) pre.hidden = true;
    resize();
    seedDrops();

    /* resize() se planta si mide 0 de ancho, y eso pasa de verdad: si las
       fuentes resuelven antes de que el layout tenga medidas, el retrato
       se queda con el canvas por defecto de 300x150 y ya nada vuelve a
       intentarlo. El observer lo recoge en cuanto el elemento tiene
       tamaño, y de paso cubre el reflow de la cabecera. */
    if ('ResizeObserver' in window){
      let last = 0;
      new ResizeObserver(() => {
        const w = cv.clientWidth;
        if (w && w !== last){ last = w; resize(); }
      }).observe(cv);
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    /* Arranca ya, y el observer solo PAUSA. Al reves — arrancar unicamente
       desde el callback del observer — la animacion depende de que ese
       callback llegue, y se entrega en el mismo paso de renderizado que el
       rAF: si no llega, no hay retrato animado y no hay forma de
       recuperarse. Asi el caso malo es gastar unos frames de mas, no
       quedarse quieto. */
    start();

    // No animar fuera de pantalla ni con la pestaña en segundo plano:
    // es una decoracion, no tiene por que gastar bateria de fondo.
    if ('IntersectionObserver' in window){
      new IntersectionObserver(es => {
        if (es[0].isIntersecting && !document.hidden) start(); else stop();
      }, { threshold: 0 }).observe(cv);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  });
})();
