# kcuevasb.github.io

CV interactivo de Kepa Cuevas Barrasa — Software Engineer.

Cinco capítulos, cada uno con la estética de la herramienta de su época, y una portada
que hace de índice. Sin frameworks ni build step: HTML + CSS + JS puro sobre GitHub Pages.

## Estructura

| Ruta | Qué es |
|---|---|
| `index.html` + `select.css` | Portada: retrato en `<canvas>` y las cinco tarjetas |
| `portrait.js` | Genera el retrato en lluvia de Matrix a partir de `perfil.png` |
| `win98/` | Capítulo 01 — antes del código, en clave Windows 98 |
| `nttdata/` | Capítulo 02 — NTT Data, en clave Eclipse |
| `knowmad/` | Capítulo 03 — Knowmad Mood, en clave IntelliJ IDEA |
| `ia/` | Capítulo 04 — Sopra Steria, como conversación con una IA |
| `matrix/` | Capítulo 05 — proyectos propios, en clave Matrix |
| `cv/` | CV clásico en una página, exportable a PDF desde el navegador |
| `shared.css` | Base común a los capítulos |
| `lang.css` + `flags/` | Selector de idioma |

## Idiomas

El sitio existe en castellano (raíz), inglés (`/en/`) y euskera (`/eu/`). Cada árbol es
una copia completa: las tres versiones comparten CSS y los scripts que no llevan texto,
y tienen script propio las que sí lo llevan (`win98`, `matrix`, `ia`).

Las páginas se enlazan entre sí con `hreflang` y el selector de banderas, que marca el
idioma actual con `aria-current`.

## Seguridad

Todo el contenido es público por definición: es un sitio estático servido por GitHub
Pages, sin backend ni datos privados. Las medidas que sí aplican:

- **CSP** en cada página vía `<meta http-equiv>`, con `script-src 'self'` — no hay ni un
  `<script>` en línea en todo el sitio, así que uno inyectado quedaría bloqueado.
- Todos los enlaces externos con `rel="noopener"`.
- Sin analítica, sin cookies y sin peticiones de red desde el JavaScript.
- Único tercero: Google Fonts (hojas y ficheros de fuente).

## Desarrollo local

```bash
npx serve .
```

Construido con [Claude Code](https://claude.com/claude-code).
