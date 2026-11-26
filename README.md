# mezzita.com

Sitio estático de Mezzita. Se construye con `python3 build.py` (Python 3.12, sin dependencias) y se despliega solo al hacer push a `main`: Cloudflare Pages (proyecto `mezzita-site`, conectado a este repo) corre `python3 build.py` y publica `dist/` en mezzita.com. Variable en Cloudflare: `PYTHON_VERSION=3.12`. `SITE_URL` por defecto es `https://mezzita.com`.

Herramientas en `tools/` (`cd tools && npm install` una vez):

- `node gen/gen.js`: regenera iconos, `og.jpg`/`og.png`, portadas de LinkedIn y los PDF de `assets/docs/` desde la marca (`assets/favicon.svg`, `tools/gen/brand.css`).
- `node check.js`: con `dist/` servido en `localhost:8765`, recorre el sitemap a 1440 y 390 px (estado, consola, desborde, imágenes, menciones de la marca anterior).
- `node --test 'tools/test/*.test.js'` (desde la raíz, sin dependencias): pruebas de la tabla de respuestas → plan del demo en vivo (`assets/demo-vivo/mapping.js`).

- `src/*.html`: páginas (comentario JSON de metadatos + contenido del `<main>`).
- `src/blog/<rubro>/<slug>.html`: posts del blog (ver `research/BRIEF_REDACCION.md`).
- `src/_partials/`: fragmentos reutilizables (`{{include:nombre}}`).
- `assets/`: CSS, JS e imágenes.
- `dist/`: salida para producción (generada, no se versiona).
- `research/`: investigación por rubro y brief de redacción.
- `AUDIT.md`: notas de cada versión.
