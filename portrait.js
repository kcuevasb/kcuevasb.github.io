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
  /* GEOMETRIA DEL HOMBRO — leer antes de tocar FLARE o SIDE_AT.

     La progresion de ancho, en celdas de las 58 de la rejilla y de la base
     del cuello hacia abajo:

       24, 26, 27, 29, 32, 35, 42, 48, 54, 56, 58, 58, 58

     Hay que acertar en dos cosas a la vez y son independientes:

     1. HACIA DONDE ensancha. Tiene que ser hacia los BORDES del marco, no
        hacia la cabeza: la parte de arriba, junto al cuello, se queda
        estrecha (24, 26, 27) y el crecimiento se va hacia fuera. Bajar
        FLARE a secas fue el error — con 1.0 la zona del cuello pasaba a
        26, 31, 34, 38, 41, o sea el bulto crecia contra la cabeza.

     2. CUANTO CAE mientras ensancha. El hombro tiene que describir una
        curva que baja hasta topar con el lateral, no salir en horizontal
        y apoyarse en el borde durante media docena de filas. Se mide por
        las filas que quedan al ancho completo: con SIDE_AT 0.88 eran 6 y
        se veia tumbado; con 0.94 son 3, y el tramo de bajada — de 42 a 58
        celdas — pasa de 2 filas a 4.

     Las dos constantes tiran en direcciones opuestas y hay que moverlas a
     la vez. SIDE_AT adelanta la altura a la que se alcanza el lateral pero
     por si solo comprime la curva y engorda la parte de arriba; FLARE alto
     compensa manteniendo el hombro estrecho mas tiempo.

     Por encima de SIDE_AT 0.97 el resultado es indistinguible de no tener
     salida lateral, y ahi las esquinas de abajo se quedan vacias. Y
     recortar filas por abajo no vale: no adelgaza el hombro, deja hueco y
     sube el retrato dentro del cuadro. */
  const SHOULDER_AT = 0.70; // altura desde la que se simetrizan los hombros
  const PROFILE_W = 5;    // ventana de la mediana que pule el perfil
  const CLOSE_W = 12;     // ventana del cierre que borra las mellas largas
  const CLOSE_FROM = 0.35; // altura desde la que se cierra (debajo de la coronilla)
  const FLOOR = 0.40;     // brillo minimo dentro de la figura
  const RIM = 0.62;       // brillo minimo en el borde de la silueta
  const SHOULDER_IN = 4;  // columnas que se estrecha el hombro
  const FLARE = 3.5;      // curva con la que el hombro sale del encuadre
  const SIDE_AT = 0.94;   // altura a la que el hombro alcanza el lateral
  const TONE_CAP = 1.2;   // techo de luz del hombro, sobre el tono de su fila
  const PIT = 0.62;       // por debajo de esta fraccion del entorno, es un pozo
  const PIT_TO = 0.85;    // a que fraccion del entorno se sube el pozo
  const CONTRAST = 1.3;   // expansion del contraste dentro de la figura
  const UNSHARP = 2.2;    // realce local de los rasgos de la cara
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

  /* Rampa de verdes: de la lluvia de fondo apagada al blanco verdoso de las
     zonas mas iluminadas de la cara.

     Para ACLARAR el verde hay dos caminos y dan resultados distintos: subir
     el rojo aclara pero tira a oliva y descolorido, mientras que subir verde
     y azul aclara hacia menta y sigue leyendose verde. Se va por el segundo,
     por eso el rojo se mueve poco y el azul es el que mas sube.

     Pero aclarar sin mirar el RECORRIDO cuesta contraste: si los tramos
     medios suben mas que el techo, el rango se comprime y la cara se aplana
     — paso, y la distancia de luminancia entre el tono 0.62 y el maximo bajo
     de 77 a 50. Con estos valores el recorrido vuelve a 73 conservando el
     menta. Y ojo: eso NO se arregla desde la mascara. Se probo subir UNSHARP
     y bajar CONTRAST con la rampa comprimida y el contraste no se movia,
     porque el 42% de la cara ya esta pegada al techo y el realce solo empuja
     mas celdas contra el. */
  const STOPS = [
    [  0.00, [  8,  40,  24]],
    [  0.30, [ 10, 120,  68]],
    [  0.62, [ 40, 214, 122]],
    [  0.85, [126, 245, 175]],
    [  1.00, [214, 253, 230]]
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


    // Copia previa: hace falta saber luego que celdas son inventadas.
    const real = keep.slice();

    /* Aqui se deja de ser fiel a la foto para que el retrato se lea, que es
       lo que pide un retrato. Se trabaja sobre el PERFIL — la x del primer y
       del ultimo pixel de figura de cada fila — y luego se reconstruye la
       silueta a partir de el. Eso rellena de paso cada fila de extremo a
       extremo, que es lo que cierra las mordidas del cuello de la camisa:
       al ser claro se confundia con el fondo y abria una muesca bajo la
       barbilla.

       El perfil se filtra con una MEDIANA, no con un cierre morfologico ni
       con una media. La mediana se lleva las mellas sueltas sin arrastrar la
       forma: probado, un cierre necesitaba una ventana tan ancha para
       cerrarlas que aplanaba la coronilla (de 41 a 57 px de ancho), mientras
       que la mediana la deja en 42. Las mellas del lado izquierdo bajan de
       14 px de fondo a 6, y las del derecho de 36 a 5, que es menos de una
       celda de la rejilla. La media posterior solo quita el escalonado. */
    const profileMedian = a => a.map((v, y) => {
      if (v < 0) return v;
      const g = [];
      for (let k = -PROFILE_W; k <= PROFILE_W; k++){
        const j = y + k;
        if (j < 0 || j >= N || a[j] < 0) continue;   // fila vacia: no cuenta
        g.push(a[j]);
      }
      g.sort((p, q) => p - q);
      return g[g.length >> 1];
    });
    const profileMean = (a, w) => a.map((v, y) => {
      if (v < 0) return v;
      let t = 0, n = 0;
      for (let k = -w; k <= w; k++){
        const j = y + k;
        if (j < 0 || j >= N || a[j] < 0) continue;
        t += a[j]; n++;
      }
      return Math.round(t / n);
    });

    const rawL = [], rawR = [];
    for (let y = 0; y < N; y++){
      let l = -1, r = -1;
      for (let x = 0; x < N; x++) if (keep[y*N + x]){ if (l < 0) l = x; r = x; }
      rawL.push(l); rawR.push(r);
    }
    const profL = profileMean(profileMedian(rawL), 2);
    const profR = profileMean(profileMedian(rawR), 2);

    /* La mediana se lleva las mellas cortas, pero la de debajo de la oreja
       — que es barba en sombra tomada por fondo — mide unas catorce filas,
       mas que la ventana de la mediana, y sobrevivia entera: el borde
       izquierdo se metia diecinueve pixeles y volvia a salir. Un cierre 1D
       con ventana mayor que la mella la borra del todo.

       Se aplica solo por debajo de la coronilla porque arriba aplanaria la
       curva de la cabeza: el cierre no distingue una concavidad de la
       pendiente con la que se abre el craneo. */
    const runProfile = (a, w, max) => a.map((v, y) => {
      if (v < 0) return v;
      let b = v;
      for (let k = -w; k <= w; k++){
        const j = y + k;
        if (j < 0 || j >= N || a[j] < 0) continue;
        b = max ? Math.max(b, a[j]) : Math.min(b, a[j]);
      }
      return b;
    });
    // Izquierda: menor x es mas figura, asi que cerrar es minimo y luego maximo.
    const closedL = runProfile(runProfile(profL, CLOSE_W, false), CLOSE_W, true);
    const closedR = runProfile(runProfile(profR, CLOSE_W, true), CLOSE_W, false);
    for (let y = Math.floor(N * CLOSE_FROM); y < N; y++){
      profL[y] = closedL[y];
      profR[y] = closedR[y];
    }

    /* Simetria de los hombros. En la foto esta girado, asi que el torso sale
       descentrado y un hombro se corta antes que el otro por mucho que se
       ensanche el recorte — se comprobo que mas alla del corte ya es fondo
       de verdad, no es un fallo de deteccion. Se refleja el alcance del
       hombro largo sobre el corto, tomando como eje el centro del encuadre,
       y se suaviza el alcance para que la linea del hombro no salga a
       escalones. */
    const cx = (N - 1) / 2;
    const shoulderFrom = Math.floor(N * SHOULDER_AT);
    const reach = profL.map((v, y) => v < 0 ? -1 : Math.max(cx - v, profR[y] - cx));
    const reachS = profileMean(profileMedian(reach), 3);

    keep.fill(0);
    for (let y = 0; y < N; y++){
      if (profL[y] < 0) continue;
      let x0 = profL[y], x1 = profR[y];
      if (y >= shoulderFrom){
        /* El hombro se estrecha, NO se acorta. Recortar filas por abajo deja
           hueco bajo el busto y lo que hace es subir el retrato dentro del
           cuadro, que es justo lo contrario de adelgazar el hombro. */
        const base = Math.max(0, reachS[y] - SHOULDER_IN * (N / COLS));

        /* El torso de la foto deja de ensancharse antes de llegar al borde,
           asi que el hombro se quedaba en una meseta y parecia cortado a
           media altura en vez de salirse del cuadro. Se le anade una
           apertura que termina en el borde inferior. */
        const t = Math.min(1, (y - shoulderFrom) / (N * SIDE_AT - shoulderFrom));
        const r = base + (cx - base) * Math.pow(t, FLARE);

        x0 = Math.max(0, Math.round(cx - r));
        x1 = Math.min(N - 1, Math.round(cx + r));
      }
      for (let x = x0; x <= x1; x++) keep[y*N + x] = 1;
    }

    /* La silueta inventada no puede tomar su luz de la foto: debajo de esas
       celdas no hay chaqueta, hay fondo, y el fondo tiene otra luminancia.
       Por eso el hombro rellenado se veia de otro material que el bueno.
       Se le da la luz de su reflejo, que es el hombro de verdad — inventar
       la forma obliga a inventar tambien la luz, si no el parche canta. */
    /* Tono propio de cada fila: la mediana de la luz de la figura REAL que
       haya en ella. Se arrastra hacia abajo el ultimo tono conocido para las
       filas que ya son todo invento. */
    const rowTone = new Float32Array(N);
    let lastTone = -1;
    for (let y = 0; y < N; y++){
      const v = [];
      for (let x = 0; x < N; x++) if (real[y*N + x]) v.push(L[y*N + x]);
      if (v.length){ v.sort((a, b) => a - b); lastTone = v[v.length >> 1]; }
      rowTone[y] = lastTone;
    }

    const lumSrc = new Float32Array(N * N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++){
        const i = y*N + x;
        if (!keep[i] || real[i]){ lumSrc[i] = L[i]; continue; }
        const mx = Math.min(N - 1, Math.max(0, Math.round(2*cx - x)));
        const j = y*N + mx;
        if (real[j]){ lumSrc[i] = L[j]; continue; }
        /* Sin reflejo real que copiar hay que inventar el tono, y NO vale la
           luz que tiene la foto ahi: debajo del hombro inventado hay fondo
           claro, asi que copiarla metia rachas de celdas casi blancas dentro
           de la chaqueta. Se prolonga el negro propio del hombro. */
        lumSrc[i] = rowTone[y] >= 0 ? rowTone[y] : L[i];
      }

    /* Techo de luz en la zona del hombro.

       En las ultimas filas quedaban rachas de celdas casi blancas dentro de
       la chaqueta, y no venian del invento: son esquinas de fondo claro que
       el relleno encerro y dio por figura, conservando su luz. Ahi abajo no
       hay rasgos que preservar — es todo chaqueta — asi que se le pone un
       techo por encima del tono de la fila y el hombro conserva su negro
       hasta el borde. */
    for (let y = shoulderFrom; y < N; y++){
      if (rowTone[y] < 0) continue;
      const techo = rowTone[y] * TONE_CAP;
      for (let x = 0; x < N; x++){
        const i = y*N + x;
        if (keep[i] && lumSrc[i] > techo) lumSrc[i] = techo;
      }
    }

    // Bajar a la rejilla promediando: da bordes suaves de regalo.
    const alpha = new Float32Array(COLS * ROWS), lum = new Float32Array(COLS * ROWS);
    for (let gy = 0; gy < ROWS; gy++)
      for (let gx = 0; gx < COLS; gx++){
        let f = 0, l = 0, n = 0;
        for (let y = Math.floor(gy*N/ROWS); y < Math.floor((gy+1)*N/ROWS); y++)
          for (let x = Math.floor(gx*N/COLS); x < Math.floor((gx+1)*N/COLS); x++){
            f += keep[y*N + x]; l += lumSrc[y*N + x]; n++;
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

    /* Relleno de pozos.

       El hueco que quedaba bajo la oreja es barba, no un agujero: la barba
       en sombra cae tan por debajo de lo que la rodea que el ojo lee un
       trozo que falta. Como es barba, lo que corresponde es darle el tono de
       lo que tiene alrededor, no iluminarlo aparte.

       Se busca cada celda que este muy por debajo de la MEDIANA de sus
       vecinas de figura y se la sube hasta cerca de esa mediana. La mediana
       y no la media: junto a un rasgo oscuro de verdad, como la linea de la
       boca, la media se hunde y el pozo dejaria de detectarse. Se lee de una
       copia para que una celda ya corregida no arrastre a la siguiente. */
    const src = out.slice();
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++){
        const i = y*COLS + x;
        if (alpha[i] < 0.6) continue;
        const vec = [];
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++){
            const yy = y + dy, xx = x + dx;
            if (yy < 0 || xx < 0 || yy >= ROWS || xx >= COLS) continue;
            const j = yy*COLS + xx;
            if (j === i || alpha[j] < 0.6) continue;
            vec.push(src[j]);
          }
        if (vec.length < 8) continue;
        vec.sort((a, b) => a - b);
        const med = vec[vec.length >> 1];
        if (src[i] < PIT * med) out[i] = PIT_TO * med;
      }

    /* Luz de contorno.

       Los huecos que se seguian viendo — el de debajo de la oreja, sobre
       todo — no eran agujeros de silueta: la silueta ya sale entera. Eran
       sombras cerradas que caen justo en el BORDE, y ahi el ojo no lee una
       sombra, lee que falta un trozo de cabeza. Subir el suelo de toda la
       figura no lo arreglaba (probado con 0.50, 0.56 y 0.62: el borde no
       mejoraba y la cara perdia un tercio de su contraste), porque el
       problema no es cuanta luz tiene la cara sino que el contorno se corte.

       Asi que el minimo se aplica solo a las celdas del borde. El contorno
       queda continuo y el interior conserva su rango para los rasgos. */
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++){
        const i = y*COLS + x;
        if (alpha[i] < 0.5) continue;
        /* El vecino de ABAJO no cuenta como contorno. El busto siempre sale
           del encuadre por abajo, asi que ahi no hay silueta que perfilar:
           hay un corte. Contarlo encendia la ultima fila entera al valor del
           contorno y dibujaba una raya horizontal de lado a lado bajo el
           retrato — medido, 44 de 58 celdas de esa fila a 0.62 clavado. */
        /* Los vecinos se calculan con x e y, no sumando y restando al indice:
           en la primera columna, i-1 cae en la ultima celda de la fila de
           arriba y en la ultima columna i+1 cae en la primera de la de
           abajo. Con el hombro tocando ya los lados del cuadro, esas celdas
           existen y el fallo se notaria. */
        let borde = false;
        for (const [dx, dy] of [[-1,0],[1,0],[0,-1]]){
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || xx >= COLS || yy < 0){ borde = true; break; }
          if (alpha[yy*COLS + xx] < 0.5){ borde = true; break; }
        }
        if (borde) out[i] = Math.max(out[i], RIM * alpha[i]);
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
          ? 'rgba(208,252,226,' + a.toFixed(3) + ')'
          : 'rgba(45,236,128,' + a.toFixed(3) + ')';
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
