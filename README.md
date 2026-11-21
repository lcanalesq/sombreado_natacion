# Sombreado de Programas (PWA)

Versión móvil del notebook de Colab `Sombreados_programas`. Lee el PDF del programa (HY-TEK Meet Manager),
aplica las mismas reglas de sombreado y devuelve `Resaltado_<nombre>.pdf`. Todo se procesa en el celular
con MuPDF.js 1.28.6, el mismo motor y la misma versión que usa PyMuPDF, así que el resultado sale idéntico al de Colab.

## Reglas (iguales al script Python)
| Color | Regla |
|---|---|
| Rojo-rosado (1, 0.4, 0.4) | "Canales, Adriana" en la misma línea que "FSC" (\|Δy\| < 3). Rect: FSC.x0−110 → FSC.x1+50 |
| Gris (0.8, 0.8, 0.8) | Cada "YAKU" que no esté en la línea de Adriana (\|Δy\| < 5). Mismo rect |
| Amarillo (1, 1, 0) | Cada "FSC" que no esté en la línea de Adriana (\|Δy\| < 5). Mismo rect |
| Celeste (0.5, 0.8, 1) | Nombres de la columna A de la hoja de Google. Rect: nombre.x0 → nombre.x1+100 |
| Verde (0, 1, 0) | Nombres de la columna B. Rect: solo el nombre |

El nombre, los clubes, OFFSET, NOMBRE_EXTRA y la URL de la hoja se pueden cambiar en **Ajustes** dentro de la app.

## Publicar en GitHub Pages (una sola vez)
```bash
cd sombreado_natacion
git init && git add . && git commit -m "PWA sombreado"
git branch -M main
git remote add origin https://github.com/lcanalesq/sombreado_natacion.git
git push -u origin main
```
En GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**.
Al minuto queda en `https://lcanalesq.github.io/sombreado_natacion/`.

Para instalarla en el celular, abre esa URL:
- **Android (Chrome):** menú ⋮ → *Instalar app*. Después también aparece en *Compartir → Sombreado* al compartir un PDF desde WhatsApp o Archivos.
- **iPhone (Safari):** Compartir → *Agregar a inicio*.

## Actualizar la app
Cambia `VERSION` en `sw.js` (por ejemplo `v1.0.1`) en cada cambio, para que los celulares descarguen la nueva versión.

## Archivos
- `index.html`: interfaz
- `app.js`: lectura de la hoja, flujo de carga, descarga y compartir, ajustes
- `sombrear.js`: lógica de sombreado (port 1:1 del Python)
- `sw.js`: modo sin internet y recepción de PDFs compartidos
- `vendor/mupdf/`: motor MuPDF.js (AGPL)
