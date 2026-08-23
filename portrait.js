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

  /* La rejilla marca el detalle del retrato, pero no se puede subir sin
     mirar el tamaño de celda: el glifo se dibuja a cellW y por debajo de
     unos 5px los katakana se empastan y dejan de leerse como glifos. Por
     eso al subir de 46x36 a 58x45 crece tambien el retrato (320 -> 352px),
     y la celda se queda en ~6px en vez de caer a 5.5. La proporcion
     COLS/ROWS se mantiene (1.29) para que la celda conserve su forma. */
  const COLS = 58, ROWS = 45;
  /* Cuadrado que entra la cabeza entera y los hombros. Se ensancho de
     0.708 a 0.756 porque el encuadre anterior cortaba el hombro derecho:
     en la foto esta girado y el torso sale descentrado, asi que el borde
     del recorte llegaba antes de que el hombro terminase de abrirse. Con
     este, la fila inferior pasa de cubrir el 72% del ancho al 93%. */
  const CROP = { x: 0.121, y: 0.066, w: 0.756 };
  const SAMPLE = 200;     // resolucion a la que se analiza la foto
  const EDGE_K = 5;       // columnas de borde que estiman el fondo
  const FIG_TH = 12;      // distancia al fondo a partir de la cual hay contorno
  const MORPH = 3;        // radio de limpieza de forma, en pixeles de SAMPLE
  const SHOULDER_AT = 0.70; // altura desde la que se simetrizan los hombros
  const FLOOR = 0.30;     // brillo minimo dentro de la figura
  const CONTRAST = 1.3;   // expansion del contraste dentro de la figura
  const UNSHARP = 1.4;    // realce local de los rasgos de la cara
  const BLUR_R = 3;       // radio del desenfoque de referencia, en celdas
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
  // Una sola definicion: la usan la capa base, la mutacion y las gotas.
  const cellFont = () => cellW.toFixed(2) + 'px "M PLUS 1 Code", "MS Gothic", monospace';
  let drops = [];
  let raf = 0, lastFrame = 0, running = false;

  /* Erosion o dilatacion con elemento cuadrado, en dos pasadas 1D en vez de
     una 2D: para radio 3 son 14 lecturas por pixel en lugar de 49. */
  function morph(src, r, dilate){
    const N = SAMPLE;
    const tmp = new Uint8Array(N * N), out = new Uint8Array(N * N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++){
        let v = dilate ? 0 : 1;
        for (let k = -r; k <= r; k++){
          const xx = Math.min(N - 1, Math.max(0, x + k));
          v = dilate ? (v | src[y*N + xx]) : (v & src[y*N + xx]);
        }
        tmp[y*N + x] = v;
      }
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++){
        let v = dilate ? 0 : 1;
        for (let k = -r; k <= r; k++){
          const yy = Math.min(N - 1, Math.max(0, y + k));
          v = dilate ? (v | tmp[yy*N + x]) : (v & tmp[yy*N + x]);
        }
        out[y*N + x] = v;
      }
    return out;
  }

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

    /* Fondo por fila: mediana de cada borde — mediana y no media, para que
       un pelo suelto o una mota no arrastren la estimacion. Se modela como
       una rampa de un borde al otro, que absorbe de una vez el degradado
       vertical, las bandas y la iluminacion asimetrica. */
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

    // Contorno: pixeles que se apartan del fondo estimado.
    const edge = new Uint8Array(N * N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++){
        const bg = BL[y] + (BR[y] - BL[y]) * (x / (N - 1));
        edge[y*N + x] = Math.abs(L[y*N + x] - bg) > FIG_TH ? 1 : 0;
      }

    // Fondo = lo alcanzable desde el borde de la imagen sin cruzar el
    // contorno. Lo que no se alcanza queda dentro, agujeros de la cara
    // incluidos: eso es lo que rellena la cara.
    const outside = new Uint8Array(N * N);
    const q = [];
    const flood = i => { if (!outside[i] && !edge[i]){ outside[i] = 1; q.push(i); } };
    for (let x = 0; x < N; x++){ flood(x); flood((N-1)*N + x); }
    for (let y = 0; y < N; y++){ flood(y*N); flood(y*N + N-1); }
    while (q.length){
      const i = q.pop(), x = i % N, y = (i / N) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        flood(ny*N + nx);
      }
    }

    /* Limpieza de forma antes de decidir la silueta definitiva.

       Apertura (erosionar y volver a dilatar): se lleva las estructuras mas
       finas que el radio. Son las lineas que salian de la cabeza, el cuello
       y los hombros hacia los lados — el fondo tiene bordes duros donde
       cambian sus bandas, y esos bordes encierran tiras estrechas de fondo
       que el relleno no alcanza y acaban pegadas a la figura.

       Cierre (dilatar y volver a erosionar): tapa las mordidas del contorno,
       donde la chaqueta se parece demasiado al fondo.

       El radio va en pixeles de SAMPLE, no del canvas: si se cambia la
       resolucion de analisis hay que reescalarlo. */
    let solid = new Uint8Array(N * N);
    for (let i = 0; i < N * N; i++) solid[i] = outside[i] ? 0 : 1;
    solid = morph(morph(solid, MORPH, false), MORPH, true);   // apertura
    solid = morph(morph(solid, MORPH, true), MORPH, false);   // cierre

    /* Solo la mancha de la persona. Donde el fondo tiene un borde duro
       quedan islotes sueltos que, si no, aparecen como trozos de figura
       flotando alrededor de la cabeza. Se siembra en el centro del borde
       inferior, que es por donde la persona sale del encuadre. */
    const keep = new Uint8Array(N * N);
    const q2 = [];
    for (let x = Math.floor(N * 0.3); x < N * 0.7; x++){
      const i = (N - 1) * N + x;
      if (solid[i] && !keep[i]){ keep[i] = 1; q2.push(i); }
    }
    while (q2.length){
      const i = q2.pop(), x = i % N, y = (i / N) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const j = ny*N + nx;
        if (keep[j] || !solid[j]) continue;
        keep[j] = 1; q2.push(j);
      }
    }


    /* Aqui se deja de ser fiel a la foto para que el retrato se lea, que es
       lo que pide un retrato.

       1. Relleno de cada fila de extremo a extremo. Un busto es convexo en
          horizontal a casi cualquier altura, asi que si en una fila hay
          figura a izquierda y a derecha, lo de en medio es figura tambien.
          Se lleva por delante las mordidas que dejaba el cuello de la
          camisa: al ser claro se confundia con el fondo y abria una muesca
          bajo la barbilla que parecia un agujero. Esto va DESPUES de
          quedarnos con la mancha conectada; si fuese antes, un islote suelto
          en un lateral rellenaria toda la fila hasta el cuerpo.

       2. Simetria de los hombros. En la foto esta girado, asi que el torso
          sale descentrado y un hombro se corta antes que el otro por mucho
          que se ensanche el recorte — se comprobo que mas alla del corte ya
          es fondo de verdad, no es un fallo de deteccion. Se refleja el
          alcance del hombro mas largo sobre el corto, tomando como eje el
          centro del encuadre. */
    for (let y = 0; y < N; y++){
      let l = -1, r = -1;
      for (let x = 0; x < N; x++) if (keep[y*N + x]){ if (l < 0) l = x; r = x; }
      if (l >= 0) for (let x = l; x <= r; x++) keep[y*N + x] = 1;
    }

    const shoulderFrom = Math.floor(N * SHOULDER_AT);
    const cx = (N - 1) / 2;
    for (let y = shoulderFrom; y < N; y++){
      let l = -1, r = -1;
      for (let x = 0; x < N; x++) if (keep[y*N + x]){ if (l < 0) l = x; r = x; }
      if (l < 0) continue;
      const reach = Math.max(cx - l, r - cx);
      const x0 = Math.max(0, Math.round(cx - reach));
      const x1 = Math.min(N - 1, Math.round(cx + reach));
      for (let x = x0; x <= x1; x++) keep[y*N + x] = 1;
    }

    // Bajar a la rejilla promediando: da bordes suaves de regalo.
    const alpha = new Float32Array(COLS * ROWS), lum = new Float32Array(COLS * ROWS);
    for (let gy = 0; gy < ROWS; gy++)
      for (let gx = 0; gx < COLS; gx++){
        let f = 0, l = 0, n = 0;
        for (let y = Math.floor(gy*N/ROWS); y < Math.floor((gy+1)*N/ROWS); y++)
          for (let x = Math.floor(gx*N/COLS); x < Math.floor((gx+1)*N/COLS); x++){
            f += keep[y*N + x]; l += L[y*N + x]; n++;
          }
        alpha[gy*COLS + gx] = f / n;
        lum[gy*COLS + gx] = l / n;
      }

    /* Dentro de la figura el brillo sigue la luminancia real, y por eso la
       piel brilla y el pelo queda apagado — igual que en el plano de Neo.
       Normalizado con los percentiles de LA FIGURA, no de la imagen entera:
       si entra el fondo en la cuenta, la cara se queda sin rango. */
    const inside = [];
    for (let i = 0; i < alpha.length; i++) if (alpha[i] > 0.5) inside.push(lum[i]);
    inside.sort((a, b) => a - b);
    const at = t => inside[Math.min(inside.length - 1, Math.floor(t * inside.length))];
    const lo = at(0.05), hi = at(0.95), range = (hi - lo) || 1;

    /* Realce local de detalle, o mascara de enfoque de toda la vida.

       Sin esto la cara sale plana. El motivo: el brillo se normaliza con los
       percentiles de TODA la figura, y el pelo y la chaqueta se llevan el
       rango bajo, asi que los rasgos — que viven en un margen estrecho de
       luz — se comprimen hasta desaparecer y la cabeza queda como una mancha
       uniforme. Restando una version desenfocada y amplificando la
       diferencia, cada rasgo recupera su contraste local sin perder la
       estructura general de luces y sombras. */
    const blur = new Float32Array(alpha.length);
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++){
        let t = 0, n = 0;
        for (let dy = -BLUR_R; dy <= BLUR_R; dy++)
          for (let dx = -BLUR_R; dx <= BLUR_R; dx++){
            const yy = y + dy, xx = x + dx;
            if (yy < 0 || xx < 0 || yy >= ROWS || xx >= COLS) continue;
            const j = yy*COLS + xx;
            // Solo promedian celdas de figura: si entra el fondo en la media,
            // el borde de la silueta se rodea de un halo brillante.
            if (alpha[j] < 0.4) continue;
            t += lum[j]; n++;
          }
        blur[y*COLS + x] = n ? t / n : lum[y*COLS + x];
      }

    const out = new Float32Array(alpha.length);
    for (let i = 0; i < alpha.length; i++){
      const detail = (lum[i] - blur[i]) * UNSHARP;
      let n = Math.min(1, Math.max(0, (lum[i] + detail - lo) / range));
      // Expandir alrededor del medio separa los rasgos que aun queden juntos.
      n = Math.min(1, Math.max(0, 0.5 + (n - 0.5) * CONTRAST));
      /* El suelo NO se puede bajar para ganar mas contraste: con FLOOR 0.20
         vuelven a aparecer celdas apagadas dentro de la cara — los agujeros
         que el relleno venia justamente a cerrar. El contraste se saca
         estirando el rango, no hundiendo el minimo. */
      out[i] = alpha[i] * (FLOOR + (1 - FLOOR) * n);
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
  };
  img.src = 'perfil.png';
})();
