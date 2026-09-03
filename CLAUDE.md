# kcuevasb.github.io — CV interactivo de Kepa

Sitio estático HTML/CSS/JS puro, sin framework ni build step, publicado en GitHub
Pages desde `main`/raíz. **El repo ES el sitio**: todo lo que se commitea queda
servido públicamente.

Las convenciones genéricas de sitios estáticos y GitHub Pages (previsualización
local, token de git sin `gh`, CSP en `<meta>`, CSS de impresión, trampas de
flex/grid, método de depuración) viven en el skill global `web-vanilla`. Aquí
está solo lo propio de este repo.

## Reglas que no se negocian

- **Nunca enlazar a los repos de código** de StiEx, gim-app, Bounce ni PhotoSwipe:
  son privados a propósito. Describir el proyecto sí; enlazar como mucho al
  producto en producción (p. ej. `cartelera-app.onrender.com`).
- **Anti-duplicación entre capítulos**: formación, aficiones y la etapa pre-código
  (Domino's/Telepizza) solo en Win98; NTT Data solo en `/nttdata/`; Knowmad Mood
  solo en `/knowmad/`; Sopra Steria solo en `/ia/`; proyectos personales y skills
  autodidactas solo en Matrix. Cuando un capítulo alude a otro lo hace con un
  puntero ("esa etapa tiene su propio capítulo"), nunca copiando contenido.
- **`/cv/` debe caber SIEMPRE en una página A4.**
- No recrear el selector de pokébolas ni una edición temática de Tierra Media/LOTR:
  se probó y Kepa pidió rollback explícito ("quedaba mejor antes").
- Evitar el coloquialismo "currar/curro" en texto visible: "trabajar/trabajo".
- **⚠️ Al reestructurar, audita los textos huérfanos.** Esta web se ha reorganizado
  varias veces y cada vez quedaron textos de la estructura anterior en sitios donde
  ya no encajaban (el capítulo de la infancia conservaba el perfil profesional
  entero y un panel de skills de Java/Kubernetes). Tras mover contenido, relee cada
  página preguntándote si ese texto sigue teniendo sentido donde está ahora.

## Estructura

Portada (`index.html` + `select.css`) que hace de índice, y **cinco capítulos**,
cada uno con la estética de la herramienta de su época. Cada capítulo en su
subcarpeta con su `styles.css` y su `script.js`, más `shared.css` para lo común.

| Ruta | Capítulo | Estética |
|---|---|---|
| `/win98/` | 01 — antes del código | Windows 98: ventanas arrastrables que se fuerzan a pantalla completa por debajo de 768px (el arrastre no tiene sentido en táctil; el JS comprueba `isMobile()`) |
| `/nttdata/` | 02 — NTT Data | Eclipse IDE, Java 7/8, sin Docker/K8s/IA |
| `/knowmad/` | 03 — Knowmad Mood | IntelliJ IDEA Darcula |
| `/ia/` | 04 — Sopra Steria | Chat con IA, respuestas guionizadas con aviso explícito de que no es un modelo real |
| `/matrix/` | 05 — por mi cuenta | Terminal hacker; sus skills son las AUTODIDACTAS, nunca las laborales |
| `/cv/` | (no es capítulo) | CV formal A4 para reclutadores, con "Exportar a PDF" (`window.print()`) |

La progresión Eclipse claro (2017) → IntelliJ oscuro (2022) → chat IA (2025) es
cronológica e intencional: el tema visual cuenta la época.

**La portada es una cabecera de CV**, no un selector suelto: retrato + nombre +
rol + resumen + contacto + enlace al PDF. La columna de texto se estira al alto del
marco del retrato y el enlace al PDF cierra abajo cuadrando con su borde inferior.

Debajo, los capítulos en tres bloques que **ya no bajan en orden cronológico**,
porque lo primero que se busca es dónde estoy ahora: *Actualmente* (Sopra, sola y
con halo) | *Experiencia pasada* (Knowmad, NTT Data — de más reciente a más
antigua) | *Comienzos ⟶ Por mi cuenta* (las dos puntas que no son un empleo,
unidas por una flecha dibujada). **Los números 01–05 de las tarjetas NO se
renumeran**: identifican el capítulo y cada capítulo los imprime también en su
propia página ("Capítulo 04 — donde estoy ahora"), así que tocarlos aquí los
descuadra en quince páginas.

Encima de los bloques hay un **filtro de vista** (`filter.js`, sin texto dentro,
uno solo para los tres idiomas) que **reordena y atenúa, nunca oculta**: sube al
principio el grupo elegido y deja el otro al 34% de opacidad, clicable y en el
orden de tabulación. Con cinco tarjetas que caben en una pantalla, esconder dos
pediría un clic para ahorrar poco y dejaría a quien filtró sin ver el resto; por
lo mismo tampoco hace falta un `aria-live`, porque no desaparece nada. Tres cosas
que no hay que "simplificar": el orden se cambia **moviendo los nodos**, no con
`order` de CSS (con `order`, el foco del teclado sigue el orden del HTML y deja de
coincidir con lo que se ve); la animación es **FLIP**, que es lo único que anima un
reflujo sin animar `top` ni `height`; y la barra llega del servidor con `hidden` y
lo quita el script, porque sin JavaScript sería una fila de botones que no hace
nada — ojo, `display:flex` gana a la regla de fábrica de `[hidden]`, así que hay
que devolverle el `display:none` a mano.

## Tres idiomas

Castellano en la raíz, inglés en `/en/`, euskera en `/eu/`. **21 páginas.** Cada
árbol es una copia completa; comparten CSS y los scripts sin texto, y tienen script
propio los tres capítulos que llevan texto dentro del JavaScript (`win98`, `matrix`,
`ia`). El castellano es el idioma por defecto: vive en la raíz y no hay redirección
por idioma del navegador.

El selector de banderas va en orden **ikurriña, España, Reino Unido**, y se genera
con un script sobre las 21 páginas: a mano se descuadran solos el `aria-current`, el
`hreflang`, la bandera y el nombre del idioma en la lengua de cada página.

**⚠️ El euskera lo tradujo Claude y está pendiente de que lo revise Kepa** (él tiene
C1). No darlo por bueno; las dudas mayores están en las declinaciones del resumen de
la portada y en los párrafos del capítulo Matrix.

Al traducir: las reglas generales con `/g` sobre identificadores van **al final**,
después de la prosa, o se comen el texto que necesitan las reglas específicas. Y en
el chat de `/ia/` las palabras clave que emparejan la pregunta del usuario hay que
**sustituirlas** por términos del idioma nuevo, no traducirlas.

## Seguridad

Es un sitio estático público: **no se puede ocultar el contenido**, y ofuscar o
bloquear el clic derecho es placebo. Lo que sí aplica y ya está puesto: CSP en cada
página vía `<meta http-equiv>` con `script-src 'self'` sin `'unsafe-inline'` (viable
porque no hay ni un `<script>` en línea — si algún día se añade uno, la CSP deja de
proteger), `rel="noopener"` en todo enlace externo, y ni analítica ni cookies ni
peticiones de red desde el JS.

Dos cosas conscientes, decididas por Kepa, que **no** hay que "arreglar" por
iniciativa propia: `perfil.png` se sirve a resolución completa (reducirla cambia el
retrato de forma medible), y Google Fonts sigue siendo el único tercero.

`.claude/` está en `.gitignore` a propósito: en este repo todo lo commiteado se
publica.

## Receta: foto → retrato en lluvia de Matrix (`portrait.js`)

Si Kepa da una foto nueva para el retrato de la cabecera, **no rehagas el
algoritmo**: está entero en `portrait.js` y sus constantes están todas juntas al
principio, con comentarios que explican el porqué de cada una. Lo único que hay
que hacer es reajustar parámetros, y en este orden — cada paso da por bueno el
anterior, así que saltárselo hace perder el tiempo dos veces.

### 0. Antes de nada: cómo medir
El panel del navegador de Claude Code a menudo **no compone frames**, así que ni
`requestAnimationFrame` ni `IntersectionObserver` disparan y no se pueden hacer
capturas. Todo se verifica leyendo datos, y la clave es **instrumentar sin tocar
el fichero**: traer el fuente, inyectar una línea que exponga la máscara y
evaluarlo.

```js
const src = await fetch('/portrait.js').then(r => r.text());
const inst = src.replace('mask = buildMask(img);',
                         'mask = buildMask(img); window.__m = mask;');
window.requestAnimationFrame = cb => 0;      // que no arranque el bucle
(0, eval)(inst);
// esperar ~700ms y leer window.__m — Float32Array de COLS*ROWS, 0..1
```
Para probar un parámetro sin editar nada, encadena otro `.replace` sobre el
fuente (`'const FLARE = 2.2;'` → `'const FLARE = 1.5;'`) y compara varios valores
en un solo pase.

**Mide siempre sobre la máscara, nunca sobre el canvas renderizado**: los glifos
se sortean y unos ocupan mucha menos tinta que otros, así que el render mete un
ruido que no está en el modelo y produce falsos positivos. Si al reforzar un
arreglo el defecto AUMENTA, no has empeorado nada: estás midiendo otra cosa.

### 1. Encuadre (`CROP`)
Recorte **cuadrado** en fracciones de la imagen original. Comprueba en píxeles
que no se sale y que no corta la barbilla:
```
sx = ancho*CROP.x, sy = alto*CROP.y, lado = ancho*CROP.w
```
Métricas: la coronilla (primera fila con figura) debe caer en ~0.05–0.10 del
alto, y la fila inferior debe cubrir buena parte del ancho. Ojo: al ser cuadrado,
**ensanchar el recorte también lo alarga hacia abajo**, y pasado cierto punto
vuelve a entrar fondo por los lados — se probó 0.76, 0.80 y 0.85 y la mejor no
era la más ancha.

### 2. Contorno (`FIG_TH`)
El fondo se modela como rampa entre las medianas de los bordes de cada fila.
`FIG_TH` es la distancia en luminancia a partir de la cual hay contorno. Sube si
entra fondo, baja si se pierde pelo. Con fondo de estudio, 12 fue el valor bueno.

### 3. Silueta
Inundar el **fondo** desde el borde (lo encerrado es figura), apertura y cierre
morfológicos (`MORPH`), y quedarse con la mancha conectada al centro del borde
inferior. Verificar: 0 agujeros rodeados y 0 salientes finos.

### 4. Perfil (`PROFILE_W`, `CLOSE_W`, `CLOSE_FROM`)
Mediana para las mellas cortas y cierre 1D para las largas. **La ventana tiene
que ser mayor que la mella**: una mella de 14 filas sobrevive entera a una
mediana de ±5. El cierre solo se aplica por debajo de `CLOSE_FROM` porque arriba
aplana la curva del cráneo.

### 5. Hombro (`SHOULDER_AT`, `SHOULDER_IN`, `FLARE`, `SIDE_AT`)
Las cuatro tiran unas de otras; hay una anotación entera junto a ellas con la
progresión de ancho aprobada y las variantes rechazadas. Regla corta: `FLARE`
alto mantiene el hombro estrecho junto a la cabeza, `SIDE_AT` bajo lo saca antes
hacia el lateral. **Bajar `FLARE` a secas ensancha hacia la CABEZA, no hacia los
bordes** — fue el error que hubo que revertir.

### 6. Luz de lo inventado (`TONE_CAP`)
Lo inventado copia la luz de su reflejo real; si el reflejo tampoco es real,
hereda el tono de su fila. Nunca la luminancia local, que ahí es fondo claro y
mete manchas casi blancas dentro de una prenda oscura.

### 7. Brillo y detalle (`UNSHARP`, `CONTRAST`, `FLOOR`, `RIM`, `PIT`)
**El color va aparte y manda el del sitio**: la rampa se construye sobre
`#00ff41`, que es la `--green` del capítulo de Matrix, con rojo 0 y proporción
azul/verde 0.25 en todos los tramos. Si la cara sale plana, mira si el problema
está en la rampa antes de tocar `UNSHARP`: con el techo comprimido, subirlo no
hace nada porque buena parte de la cara ya está pegada al máximo.
Normaliza por percentiles **de la figura**, no de la imagen. `UNSHARP` recupera
los rasgos que la normalización aplasta. `FLOOR` es el suelo dentro de la figura
y `RIM` el mínimo del borde — el contorno se arregla con `RIM`, no subiendo
`FLOOR`, que solo aplana la cara.

### 8. Tamaño y rejilla
`filas = columnas × cellW / lineHeight`, con `cellW` **medido** (`measureText`),
no supuesto: las monoespaciadas japonesas avanzan 0.5em, no 0.6em. Por debajo de
~5px de celda los katakana se empastan; si el retrato se hace pequeño, no bajes
la rejilla — sube el suelo de `devicePixelRatio` a 2 en `resize()` y el glifo
recupera nitidez sin perder detalle.

### Batería de comprobación final
Sobre la máscara: agujeros rodeados, salientes finos, progresión de ancho del
hombro, contraste de la zona de la cabeza (desviación típica), celdas casi
blancas en el hombro. Sobre el render: rayas horizontales y verticales (una fila
o columna mucho más brillante que sus vecinas delata que la luz de contorno está
iluminando un corte del encuadre, que no es contorno). Y siempre: consola sin
errores, ms por frame, y móvil a 375px sin desbordar.

## Aprendido del retrato y de este repo

Lo genérico está en el skill `web-vanilla`; esto es lo que solo aplica aquí.

- **Retrato ASCII a partir de una foto: cuatro cosas hay que MEDIRLAS, no suponerlas** (todas fallaron de verdad haciendo la "foto de perfil" del CV). (1) **El orden de densidad de los glifos**: no ordenes la rampa a ojo — renderiza cada carácter en un canvas y cuenta píxeles con alpha > 0. Imprescindible si sales del clásico `@%#*+=-:. `; con katakana es imposible acertar a ojo. (2) **El ancho de celda de la fuente**: `measureText('0').width / fontSize`. Una monoespaciada latina avanza ~0.6em, pero **las monoespaciadas japonesas ('M PLUS 1 Code', 'MS Gothic') avanzan 0.5em** — asumir 0.6 estira el retrato un 20% a lo alto. La fórmula que ata el `line-height` del CSS con el número de filas del generador es `filas = columnas × cellW / lineHeight`, y hay que usar el mismo `cellW` en los dos sitios. (3) **El nivel de gris del fondo**: una foto de estudio tiene fondo gris claro, no blanco, así que vaciar solo el nivel más claro deja el fondo lleno de glifos y la silueta se pierde en una mancha uniforme — mira el histograma de niveles y vacía tantos niveles como haga falta (en el caso real, los 2 más claros ≈ 26% de las celdas). (4) **El encuadre**: calcula dónde cae el recorte en píxeles de la imagen original y compáralo con su alto; un `cropY`/`cropW` que parece razonable puede acabar cortando por la barbilla (pasó: recorte hasta y=846 sobre una foto de 1364px de alto).
- **Al pasar de una rampa ASCII a un alfabeto grande (katakana, símbolos), cuantiza en pocos niveles y reparte el glifo dentro de cada nivel** — mapear luminancia a los 65 glifos uno a uno da una imagen PLANA, porque entre dos glifos consecutivos de la rampa medida casi no hay salto de tinta y el resultado es una textura uniforme sin retrato. Con ~8 niveles (agrupando la rampa por percentiles) el contraste vuelve, y eligiendo el glifo dentro del nivel con un hash determinista de `(x,y)` se conserva la variedad visual sin que el dibujo cambie entre generaciones. Complemento: **normaliza por percentil (recorta el 2% de cada extremo), no por mínimo/máximo absolutos** — un solo píxel quemado (un brillo en la frente) se come todo el rango dinámico y aplana el resto.
- **Cuando el Browser pane no compone frames y no puedes ver la página, un retrato/gráfico ASCII sigue siendo verificable numéricamente**: reduce la matriz de niveles a bloques (media de cada bloque 4×4) e imprímela como cuadrícula de dígitos — la silueta se lee perfectamente en texto (fondo claro arriba, pelo oscuro, cara media, hombros oscuros) y delata al instante si la imagen está invertida, descuadrada o plana. Un histograma de niveles complementa: si un nivel concentra >30% de las celdas, falta contraste.
- **Separar figura de fondo en una foto para convertirla en arte generativo: pregunta qué es FONDO, no qué es figura**. Tres enfoques que parecen razonables y fallan, comprobados uno a uno sobre una foto de retrato real: (1) *umbral de brillo* — si la cara está bien iluminada su luminancia es tan alta como la del fondo de estudio y el umbral se come media cara; (2) *relleno por región desde los bordes con tolerancia local* — si el fondo tiene bandas horizontales (saltos de tono de golpe, frecuentes en JPEG o en fondos degradados) el relleno no puede cruzarlas y todo el fondo de debajo queda desconectado y contado como figura; (3) *distancia a un fondo modelado* — funciona para el CONTORNO pero deja la cara agujereada donde la piel iluminada se parece al fondo. **Lo que sí funciona**: modelar el fondo de cada fila como una rampa entre la mediana de sus píxeles de borde izquierdo y derecho (absorbe degradado vertical, bandas e iluminación asimétrica de una vez), marcar como contorno lo que se aparta de esa estimación, y luego **inundar el FONDO desde el borde de la imagen sin cruzar el contorno**: todo lo que queda encerrado es figura, por poco que se distinga. La silueta sale maciza sin agujeros por construcción.
- **Suavizar el perfil de una silueta: mediana para las mellas cortas, cierre morfológico para las largas — y la ventana tiene que ser MAYOR que el defecto**. Un filtro de mediana sobre el perfil (la x del primer y último píxel de figura de cada fila) quita las mellas sueltas sin arrastrar la forma; un cierre morfológico (mín-luego-máx para el borde izquierdo, máx-luego-mín para el derecho) rellena concavidades pero necesita una ventana tan ancha que **aplana las curvas legítimas** — medido: para cerrar una mella hacía falta ventana 14, y eso ensanchaba la coronilla de 41 a 57 px, mientras la mediana la dejaba en 42. Solución: mediana estrecha en todo el perfil + cierre ancho aplicado **solo por debajo de la zona con curvatura buena**. Y el error que costó una ronda: **un filtro de mediana no puede cerrar una mella más alta que su ventana** — con ventana ±5 una mella de 14 filas sobrevive entera, porque la mediana la ve como la forma buena.
- **Si inventas la forma, tienes que inventar también la luz**. Al reflejar un hombro cortado por el encuadre sobre el lado bueno, la silueta quedó simétrica pero el hombro inventado se veía "de otro material": seguía tomando su luminancia de la foto, y debajo de esas celdas no hay chaqueta sino fondo. Fix: que las celdas inventadas copien la luz de su reflejo real (medido: los dos hombros pasaron de delatarse a 67 y 69 de brillo). Y el caso límite que se escapa: **cuando el reflejo tampoco es figura real**, no vale caer de vuelta a la luminancia local — es fondo claro y mete rachas de celdas casi blancas dentro de una prenda oscura. Hay que heredar el tono de la fila (mediana de la luz de la figura real que haya en ella, arrastrada hacia abajo). Complemento: en zonas sin rasgos que preservar (un torso, una prenda), poner un **techo de luz** sobre el tono de la fila limpia las esquinas de fondo que el relleno haya encerrado — bajó las celdas casi blancas del 10.6% al 0.9% sin tocar el contraste de la cara.
- **Luz de contorno (rim) para que una silueta se lea, y el borde que NO es contorno**. Cuando una zona oscura cae justo en el borde de la silueta, el ojo no lee una sombra: lee que falta un trozo. Subir el suelo de brillo de toda la figura no lo arregla (probado de 0.42 a 0.62: el borde no mejoraba y la cara perdía un tercio de su contraste) porque el problema no es cuánta luz hay sino que el contorno se corta. Fix: aplicar el mínimo **solo a las celdas del borde**. **Pero el corte del encuadre no es contorno**: si el retrato sale por abajo del cuadro, contar el vecino inferior enciende la última fila entera y dibuja una raya horizontal de lado a lado (medido: 44 de 58 celdas clavadas al valor del rim). Nunca cuentes como contorno el lado por el que la figura sale del encuadre.
- **Recuperar detalle facial aplastado con máscara de enfoque**: si el brillo se normaliza con los percentiles de toda la figura, el pelo y la ropa se llevan el rango bajo y los rasgos de la cara — que viven en un margen estrecho de luz — se comprimen hasta desaparecer. Restar una versión desenfocada y amplificar la diferencia devuelve el contraste local sin perder la estructura general de luces y sombras (medido: contraste de la zona de la cabeza de 0.216 a 0.264, y aparecen cuencas de los ojos, nariz y línea de la barba donde antes había un bloque continuo). **El desenfoque debe promediar solo celdas de figura**: si entra el fondo en la media, el borde de la silueta se rodea de un halo brillante. Y ojo: el contraste se saca estirando el rango, **no hundiendo el mínimo** — bajar el suelo reabre los agujeros que el relleno venía a cerrar.
- **Si la imagen se ve plana, decide primero si el problema está en los DATOS o en el mapeo a color — no son intercambiables**. Caso real: tras aclarar la rampa, la cara perdió contraste y lo lógico parecía subir el realce local. No servía de nada: de `UNSHARP` 1.4 a 2.6 el contraste subía un 5% y en cambio mandaba de 42% a 45% de la cara a luz quemada, porque **el 42% ya estaba pegada al techo** y el realce solo empuja más celdas contra él. Bajar el contraste global tampoco lo movía. El problema estaba en la rampa de color: al aclarar, los tramos medios habían subido más que el techo y el recorrido de luminancia entre el tono medio-alto y el máximo había caído de 77 a 50. Síntoma que lo distingue: **si tocar los parámetros de los datos no mueve la métrica, mírala en el mapeo**. Y cuando el techo lo fija un color de referencia que no puedes tocar, el recorrido se gana **oscureciendo la parte baja**, no aclarando la alta.
- **Exportar un canvas animado como imagen fija, GIF o vídeo (avatar, `og:image`) sin poder ver la página**. Cuatro piezas, todas necesarias: (1) **shim de `requestAnimationFrame` a `setTimeout`** antes de cargar el script, o el panel que no compone frames deja el canvas en negro; (2) **exporta la capa BASE, no el frame compuesto** — en un retrato de lluvia de Matrix las gotas encienden columnas al azar, y lo que en movimiento da vida, congelado son rayas brillantes que no tienen que ver con la cara y emborronan el retrato (el usuario lo detectó al primer vistazo con una imagen de referencia); (3) para que la cara se lea a tamaño de avatar, **parchea el fuente al vuelo** subiendo la rejilla (58×45 → 84×65) y **levanta el fondo del negro** a un verde tenue (`if (mask[i] < FLOOR_FIGURA) mask[i] = 0.13`), que es lo que recorta la silueta; al subir la rejilla hay que escalar las constantes que van en celdas (`PROFILE_W`, `CLOSE_W`, `SHOULDER_IN`, `MORPH`) o la geometría del hombro se descuadra — verifícalo comparando el perfil de anchos por fila, normalizado, contra el de la rejilla original; (4) **no leas la imagen por el contexto**: un PNG de 640×640 son ~430 KB en base64. Levanta un receptor HTTP local de 15 líneas con `Access-Control-Allow-Origin: *` y que la página haga `fetch(..., {method:'POST', body: canvas.toDataURL()})`. Sirve igual para volcar 96 fotogramas seguidos y montarlos con ffmpeg.
- **No "optimices" la foto de origen de un generador de arte: el resultado cambia**. Servir la foto original completa de alguien es exposición real (en un CV, 1483×1364 y 1,7MB descargables), y la reacción natural es reducirla — pero el pipeline analiza bordes sobre un fondo con bandas, y el remuestreo mueve la máscara. Medido contra el original: a 1000px cambian 200 de 2610 celdas y 2 de silueta; a 500px, 332 y 8; a 400px, 373 y 21. **No hay un tamaño gratis**, así que no es una optimización sino un cambio de diseño: hay que enseñarlo y que lo decida quien aprobó el retrato. Y el matiz que cierra el tema: la foto **no se puede ocultar**, porque el generador la necesita en el navegador; reducirla limita la calidad de la copia que se lleva un scraper, nada más.
- **Añadir un idioma a un selector de banderas es un cambio de layout, no solo de contenido**. La tercera bandera ensanchó la barra de 68 a 100px y se comió el hueco que tenían reservado las barras de tres capítulos (`margin-right: 88px`), solapando en los tres idiomas — no solo en el nuevo. Regla: **cada bandera son ~32px** (26 de ancho más la separación), así que el hueco reservado tiene que derivarse del número de idiomas, y hay que volver a medir el solape después de añadir uno. Y genera el bloque del selector **con un script sobre todas las páginas** en vez de editarlas una a una: con 21 páginas × 3 idiomas, el `aria-current`, el `hreflang`, la bandera y el nombre del idioma en la lengua de cada página son cuatro cosas que se descuadran solas.
## Máscara precalculada del retrato

Desde agosto de 2026 el sitio **no publica ni el algoritmo ni la foto**. `portrait.js`
solo trae la animación (322 líneas); el análisis de la imagen (`buildMask`, 391 líneas,
más `morph` y las 20 constantes de ajuste) se ejecuta una vez en local y lo que se
sirve es `portrait-mask.js`: 58×45 celdas, 16 bits de brillo por celda, 6,8 KB de
base64. Verificado al hacer el cambio: **0 celdas cambian de tono y 0 cambian la luz
de las gotas** respecto al retrato anterior.

`perfil.png` sigue en local (está en `.gitignore`) pero ya no se sirve.

### Cómo regenerar la máscara si cambia la foto

El algoritmo ya no está en el árbol de trabajo: vive en el historial, en el último
commit antes del precálculo.

```bash
git show d2a5fcf:portrait.js > /tmp/portrait-con-algoritmo.js
```

Después: servir el sitio en local, cargar esa copia en una página **sin la CSP** (la
del sitio bloquea el `fetch` que hace falta para instrumentar), reemplazar en el
fuente `mask = buildMask(img);` por `mask = buildMask(img); window.__m = mask;`,
evaluarlo con la foto nueva, y volcar `window.__m` a 16 bits big-endian en base64:

```js
const bytes = new Uint8Array(m.length * 2);
for (let i = 0; i < m.length; i++) {
  const v = Math.round(Math.min(1, Math.max(0, m[i])) * 65535);
  bytes[i*2] = v >> 8; bytes[i*2+1] = v & 255;
}
```

Con foto nueva hay que reajustar antes las constantes siguiendo la receta de arriba;
el precálculo es el último paso, no el primero.

**Ojo con el historial**: quitar el algoritmo y la foto de `main` no los quita del
repositorio, que es público. Siguen recuperables con `git show` desde cualquier
commit anterior. Eliminarlos de verdad exigiría reescribir el historial y forzar el
push, con todos los SHA cambiados.
