// Núcleo de sombreado: réplica 1:1 de la lógica Python (PyMuPDF) usando MuPDF.js
// cfg = { nombrePrincipal, clubPrincipal, clubOtros, offset, extra, listaCeleste[], listaVerde[] }

export const COLORES = {
  principal: [1, 0.4, 0.4],   // rojo-rosado: nombre principal en su club
  otrosClub2: [0.8, 0.8, 0.8], // gris: otros del club "YAKU"
  otrosClub1: [1, 1, 0],       // amarillo: otros del club "FSC"
  celeste: [0.5, 0.8, 1],      // lista columna A
  verde: [0, 1, 0],            // lista columna B
};

const SEARCH_OPTS = undefined;

function quadToRect(q) {
  const xs = [q[0], q[2], q[4], q[6]], ys = [q[1], q[3], q[5], q[7]];
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

// Equivalente a page.search_for(): un rect por cada quad de cada coincidencia
function searchFor(page, needle) {
  if (!needle) return [];
  const hits = page.search(needle, SEARCH_OPTS);
  const out = [];
  for (const hit of hits) for (const q of hit) out.push(quadToRect(q));
  return out;
}

function highlight(page, r, color) {
  const a = page.createAnnotation("Highlight");
  a.setColor(color);
  a.setQuadPoints([[r.x0, r.y0, r.x1, r.y0, r.x0, r.y1, r.x1, r.y1]]);
  a.update();
}

export function sombrear(mupdf, bytes, cfg) {
  const doc = mupdf.PDFDocument.openDocument(bytes, "application/pdf");
  const { offset: OFFSET, extra: EXTRA } = cfg;
  const stats = { principal: 0, otrosClub2: 0, otrosClub1: 0, celeste: 0, verde: 0, paginas: doc.countPages() };

  for (let i = 0; i < stats.paginas; i++) {
    const page = doc.loadPage(i);
    const principales = searchFor(page, cfg.nombrePrincipal);
    const club2 = searchFor(page, cfg.clubOtros);     // YAKU
    const club1 = searchFor(page, cfg.clubPrincipal); // FSC

    // 1. Nombre principal en la misma línea que su club → rojo-rosado
    for (const n of principales)
      for (const f of club1)
        if (Math.abs(n.y0 - f.y0) < 3) {
          highlight(page, { x0: Math.max(f.x0 - OFFSET, 0), y0: f.y0, x1: f.x1 + EXTRA / 2, y1: f.y1 }, COLORES.principal);
          stats.principal++;
        }

    // 2. Otros YAKU (gris) y 3. otros FSC (amarillo), ignorando la línea del nombre principal
    for (const [lista, color, key] of [[club2, COLORES.otrosClub2, "otrosClub2"], [club1, COLORES.otrosClub1, "otrosClub1"]])
      for (const y of lista) {
        if (principales.some(c => Math.abs(y.y0 - c.y0) < 5)) continue;
        highlight(page, { x0: Math.max(y.x0 - OFFSET, 0), y0: y.y0, x1: y.x1 + EXTRA / 2, y1: y.y1 }, color);
        stats[key]++;
      }

    // 4. Lista columna A → celeste (nombre + EXTRA)
    for (const nombre of cfg.listaCeleste)
      for (const n of searchFor(page, nombre)) {
        highlight(page, { x0: n.x0, y0: n.y0, x1: n.x1 + EXTRA, y1: n.y1 }, COLORES.celeste);
        stats.celeste++;
      }

    // 5. Lista columna B → verde (solo el nombre)
    for (const nombre of cfg.listaVerde)
      for (const n of searchFor(page, nombre)) {
        highlight(page, n, COLORES.verde);
        stats.verde++;
      }
  }
  const out = doc.saveToBuffer("incremental=no,garbage=no").asUint8Array().slice();
  doc.destroy?.();
  return { bytes: out, stats };
}
