'use strict';
/* Retrato en lluvia de Matrix.

   La referencia es el plano de Neo mirando el codigo: el fondo es lluvia
   verde apagada y la figura es LA MISMA lluvia, pero mas brillante. Es
   decir, lo que dibuja la cara no son los glifos — todos son katakana al
   azar y van cambiando — sino cuanto brilla cada celda. Por eso esto es un
   canvas y no un <pre>: hace falta modular tono y brillo celda a celda.

   El <pre> con el retrato en ASCII se queda como fallback para cuando no
   hay JS; en cuanto esto arranca, lo sustituye. */
(function(){
  const cv = document.getElementById('portrait-rain');
  if (!cv || !cv.getContext) return;
  const pre = document.getElementById('ascii-portrait');
  const ctx = cv.getContext('2d');

  const COLS = 46, ROWS = 36;
  // Mismo encuadre que el retrato ASCII: cuadrado que entra la cabeza
  // entera y los hombros, sin cortar por la barbilla.
  const CROP = { x: 0.145, y: 0.066, w: 0.708 };
  const SAMPLE = 140;     // resolucion a la que se analiza la foto
  const EDGE_K = 5;       // columnas de borde que estiman el fondo
  const FIG_TH = 26;      // cuanto hay que separarse del fondo para ser figura
  const KNEE0 = 0.22, KNEE1 = 0.62;  // umbral suave que apaga el ruido de fondo
  const FLOOR = 0.28;     // brillo minimo dentro de la figura
  const CC_MIN = 0.15;    // por debajo de esto una celda no conecta figura
  const SHADES = 24;      // niveles de color (se agrupa el dibujo por color)
  const TRAIL = 12;       // celdas de estela por gota
  const REBUILD_MS = 380; // cada cuanto mutan los glifos
  const FRAME_MS = 1000 / 24;

  const GLYPHS = (() => {
    const a = [];
    for (let c = 0x30A2; c <= 0x30F3; c++) a.push(String.fromCharCode(c));
    for (let d = 0; d <= 9; d++) a.push(String(d));
    return a;
  })();

  /* Rampa de verdes: de la lluvia de fondo casi apagada al blanco verdoso
     de las zonas mas iluminadas de la cara. */
  const STOPS = [
    [0.00, [  7,  34,  18]],
    [0.35, [ 20, 120,  52]],
    [0.70, [ 52, 224, 108]],
    [1.00, [200, 255, 214]]
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
  let drops = [];
  let raf = 0, lastFrame = 0, lastBuild = 0, running = false;

  /* --- mascara del retrato ---------------------------------------------

     Separar figura de fondo por un umbral de brillo NO funciona con esta
     foto, y conviene dejarlo escrito: la cara esta bien iluminada, asi que
     su luminancia es tan alta como la del fondo de estudio y el umbral se
     comia media cara. Tampoco vale un relleno por region desde los bordes:
     el fondo tiene bandas horizontales (saltos de tono de golpe), el
     relleno no puede cruzarlas, y todo el fondo por debajo de la banda
     quedaba desconectado de la semilla y contado como figura.

     Lo que si funciona: estimar el fondo como una rampa entre el borde
     izquierdo y el derecho de cada fila, y quedarse con lo que se separa de
     esa estimacion. Absorbe el degradado vertical, las bandas y la
     iluminacion asimetrica, sin depender de que la cara sea oscura. */
  function buildMask(img){
    const N = SAMPLE;
    const s = document.createElement('canvas');
    s.width = N; s.height = N;
    const c = s.getContext('2d', { willReadFrequently: true });
    // Volteado: el retrato vive a la izquierda de la cabecera y la mirada
    // tiene que apuntar al nombre, no hacia fuera de la pagina.
    c.translate(N, 0); c.scale(-1, 1);
    c.drawImage(img,
      img.width * CROP.x, img.height * CROP.y, img.width * CROP.w, img.width * CROP.w,
      0, 0, N, N);
    const d = c.getImageData(0, 0, N, N).data;

    const L = new Float32Array(N * N);
    for (let i = 0, p = 0; i < d.length; i += 4, p++)
      L[p] = 0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2];

    // Fondo por fila: mediana de cada borde (mediana y no media, para que un
    // pelo suelto o una mota no arrastren la estimacion).
    const median = a => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
    const left = [], right = [];
    for (let y = 0; y < N; y++){
      const l = [], r = [];
      for (let k = 0; k < EDGE_K; k++){ l.push(L[y*N + k]); r.push(L[y*N + N-1-k]); }
      left.push(median(l)); right.push(median(r));
    }
    // Suavizado vertical: las bandas del fondo meterian escalones falsos.
    const smooth = a => a.map((_, y) => {
      let t = 0, n = 0;
      for (let k = -3; k <= 3; k++){ const j = y + k; if (j >= 0 && j < N){ t += a[j]; n++; } }
      return t / n;
    });
    const BL = smooth(left), BR = smooth(right);

    // Bajar a la rejilla promediando: da bordes suaves de regalo.
    const fig = new Float32Array(COLS * ROWS), lum = new Float32Array(COLS * ROWS);
    for (let gy = 0; gy < ROWS; gy++)
      for (let gx = 0; gx < COLS; gx++){
        let f = 0, l = 0, n = 0;
        for (let y = Math.floor(gy*N/ROWS); y < Math.floor((gy+1)*N/ROWS); y++)
          for (let x = Math.floor(gx*N/COLS); x < Math.floor((gx+1)*N/COLS); x++){
            const bg = BL[y] + (BR[y] - BL[y]) * (x / (N - 1));
            f += Math.min(1, Math.abs(L[y*N + x] - bg) / FIG_TH);
            l += L[y*N + x];
            n++;
          }
        fig[gy*COLS + gx] = f / n;
        lum[gy*COLS + gx] = l / n;
      }

    // Umbral suave: el ruido del sensor nunca da diferencia cero, y sin esto
    // el fondo queda sembrado de glifos tenues en vez de apagado.
    const knee = v => {
      const t = Math.min(1, Math.max(0, (v - KNEE0) / (KNEE1 - KNEE0)));
      return t * t * (3 - 2 * t);
    };
    const F = Array.from(fig, knee);

    /* Solo la mancha conectada a la persona. Donde el fondo tiene un borde
       duro quedan islotes sueltos (una mancha arriba, una raya en un
       lateral) que sin esto aparecen como trozos de figura flotando
       alrededor de la cabeza. Se siembra en el centro del borde inferior,
       que es por donde la persona sale del encuadre. */
    const keep = new Uint8Array(COLS * ROWS);
    const q = [];
    for (let x = Math.floor(COLS * 0.35); x < COLS * 0.65; x++){
      const i = (ROWS - 1) * COLS + x;
      if (F[i] > CC_MIN && !keep[i]){ keep[i] = 1; q.push(i); }
    }
    while (q.length){
      const i = q.pop(), x = i % COLS, y = (i / COLS) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const j = ny * COLS + nx;
        if (keep[j] || F[j] <= CC_MIN) continue;
        keep[j] = 1; q.push(j);
      }
    }

    /* Dentro de la figura el brillo vuelve a seguir la luminancia real, y
       por eso la piel brilla y el pelo queda apagado — igual que en el plano
       de Neo. Normalizado con los percentiles de LA FIGURA, no de la imagen
       entera: si entra el fondo en la cuenta, la cara se queda sin rango. */
    const inside = [];
    for (let i = 0; i < F.length; i++) if (keep[i] && F[i] > 0.5) inside.push(lum[i]);
    inside.sort((a, b) => a - b);
    const at = t => inside[Math.min(inside.length - 1, Math.floor(t * inside.length))];
    const lo = at(0.05), hi = at(0.95), range = (hi - lo) || 1;

    const out = new Float32Array(F.length);
    for (let i = 0; i < F.length; i++){
      if (!keep[i]) continue;
      const n = Math.min(1, Math.max(0, (lum[i] - lo) / range));
      out[i] = F[i] * (FLOOR + (1 - FLOOR) * n);
    }
    return out;
  }

  /* --- capa base: el retrato en glifos --------------------------------- */
  function rebuild(){
    if (!mask || !cellW) return;
    for (let i = 0; i < glyph.length; i++)
      glyph[i] = (Math.random() * GLYPHS.length) | 0;

    const b = base.getContext('2d');
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.clearRect(0, 0, COLS * cellW, ROWS * cellH);
    b.font = cellW.toFixed(2) + 'px "M PLUS 1 Code", "MS Gothic", monospace';
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

  /* --- gotas ------------------------------------------------------------ */
  function seedDrops(){
    drops = Array.from({ length: COLS }, () => ({
      y: -Math.random() * ROWS * 1.5,
      // Lento a proposito: la lluvia acompaña al retrato, no compite con el.
      v: 4 + Math.random() * 5
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

    if (now - lastBuild > REBUILD_MS){ rebuild(); lastBuild = now; }

    blit();

    ctx.save();
    // 'lighter' suma luz sobre lo que ya hay, que es justo lo que hace una
    // gota al pasar por delante de la figura: la enciende, no la tapa.
    ctx.globalCompositeOperation = 'lighter';
    ctx.font = cellW.toFixed(2) + 'px "M PLUS 1 Code", "MS Gothic", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let x = 0; x < COLS; x++){
      const d = drops[x];
      d.y += d.v * dt;
      if (d.y - TRAIL > ROWS){ d.y = -Math.random() * ROWS * 0.6; d.v = 4 + Math.random() * 5; }
      const head = Math.floor(d.y);
      for (let k = 0; k < TRAIL; k++){
        const y = head - k;
        if (y < 0 || y >= ROWS) continue;
        const i = y * COLS + x;
        const fade = 1 - k / TRAIL;
        const a = fade * fade * (k === 0 ? 0.95 : 0.5);
        ctx.fillStyle = k === 0
          ? 'rgba(215,255,228,' + a.toFixed(3) + ')'
          : 'rgba(60,220,110,' + a.toFixed(3) + ')';
        ctx.fillText(GLYPHS[glyph[i]], (x + 0.5) * cellW, (y + 0.5) * cellH);
      }
    }
    ctx.restore();
  }

  /* --- ciclo de vida ---------------------------------------------------- */
  function resize(){
    const w = cv.clientWidth;
    if (!w) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
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

  const img = new Image();
  img.onload = () => {
    mask = buildMask(img);
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    fonts.then(() => {
      if (pre) pre.hidden = true;
      cv.hidden = false;
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
  };
  img.src = 'perfil.png';
})();
