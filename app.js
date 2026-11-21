import { sombrear, COLORES } from "./sombrear.js";

// ---------------- Configuración (valores del script de Colab) ----------------
const DEFAULTS = {
  nombrePrincipal: "Canales, Adriana",
  clubPrincipal: "FSC",
  clubOtros: "YAKU",
  offset: 110,
  extra: 100,
  sheetUrl: "https://docs.google.com/spreadsheets/d/13riDfxeghNHPJ7z1lM9so3DmeKi4-S7tjaUbjthOR-I/edit",
};
const LS_CFG = "sombreado.cfg", LS_LISTAS = "sombreado.listas";

const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
let cfg = { ...DEFAULTS, ...store.get(LS_CFG, {}) };
let listas = store.get(LS_LISTAS, null); // { celeste:[], verde:[], fecha }

const $ = (id) => document.getElementById(id);

// ---------------- Google Sheets ----------------
function sheetUrls(url) {
  const id = (url.match(/\/d\/([a-zA-Z0-9-_]+)/) || [])[1];
  if (!id) throw new Error("No reconozco la URL de Google Sheets.");
  const gid = (url.match(/[#&?]gid=(\d+)/) || [])[1];
  const g = gid ? `&gid=${gid}` : "";
  return [
    `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&headers=1${g}`,
    `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${g}`,
  ];
}

function parseCSV(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function cargarListas() {
  setListaEstado("Actualizando listas…", "info");
  let lastErr;
  for (const u of sheetUrls(cfg.sheetUrl)) {
    try {
      const r = await fetch(u, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const txt = await r.text();
      if (/^\s*<(!doctype|html)/i.test(txt)) throw new Error("La hoja no es pública");
      const filas = parseCSV(txt).slice(1); // fila 1 = encabezados (igual que pandas)
      const col = (i) => filas.map((f) => (f[i] || "").trim()).filter(Boolean);
      listas = { celeste: col(0), verde: col(1), fecha: new Date().toISOString() };
      store.set(LS_LISTAS, listas);
      pintarListas();
      return true;
    } catch (e) { lastErr = e; }
  }
  pintarListas();
  setListaEstado(
    listas ? `Sin conexión con la hoja (${lastErr.message}). Uso la última copia guardada.`
           : `No pude leer la hoja (${lastErr.message}). Revisa que esté compartida como "Cualquier persona con el enlace".`,
    "warn");
  return false;
}

function setListaEstado(msg, tipo) {
  const el = $("listaEstado"); el.textContent = msg; el.dataset.tipo = tipo || "";
}

function pintarListas() {
  if (!listas) { $("cntCeleste").textContent = "–"; $("cntVerde").textContent = "–"; setListaEstado("Aún no hay listas cargadas.", "warn"); return; }
  $("cntCeleste").textContent = listas.celeste.length;
  $("cntVerde").textContent = listas.verde.length;
  const f = new Date(listas.fecha);
  setListaEstado(`Actualizado ${f.toLocaleDateString("es-PE")} ${f.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}`, "ok");
  $("verCeleste").innerHTML = listas.celeste.map((n) => `<li>${esc(n)}</li>`).join("") || "<li><em>vacía</em></li>";
  $("verVerde").innerHTML = listas.verde.map((n) => `<li>${esc(n)}</li>`).join("") || "<li><em>vacía</em></li>";
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------------- Motor PDF ----------------
let mupdfPromise = null;
const motor = () => (mupdfPromise ||= import("./vendor/mupdf/mupdf.js"));

// ---------------- Procesar ----------------
let resultado = null; // { file, url }

async function procesar(file) {
  if (!file) return;
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") { mostrarError("El archivo no es un PDF."); return; }
  $("resultado").hidden = true; $("error").hidden = true;
  $("progreso").hidden = false;
  $("progresoTxt").textContent = "Preparando…";
  try {
    if (!listas) await cargarListas();
    else cargarListas(); // refresca en segundo plano para la próxima vez
    $("progresoTxt").textContent = "Cargando motor PDF…";
    const mupdf = await motor();
    $("progresoTxt").textContent = `Sombreando ${file.name}…`;
    await new Promise((r) => setTimeout(r, 30));
    const bytes = new Uint8Array(await file.arrayBuffer());
    const t0 = performance.now();
    const { bytes: out, stats } = sombrear(mupdf, bytes, {
      nombrePrincipal: cfg.nombrePrincipal, clubPrincipal: cfg.clubPrincipal, clubOtros: cfg.clubOtros,
      offset: Number(cfg.offset), extra: Number(cfg.extra),
      listaCeleste: listas?.celeste || [], listaVerde: listas?.verde || [],
    });
    const base = file.name.replace(/\.pdf$/i, "");
    const outName = `Resaltado_${base}.pdf`;
    if (resultado?.url) URL.revokeObjectURL(resultado.url);
    const outFile = new File([out], outName, { type: "application/pdf" });
    resultado = { file: outFile, url: URL.createObjectURL(outFile) };
    mostrarResultado(outName, stats, performance.now() - t0);
  } catch (e) {
    console.error(e);
    mostrarError(`No se pudo procesar el PDF: ${e.message || e}`);
  } finally {
    $("progreso").hidden = true;
    $("archivo").value = "";
  }
}

function mostrarResultado(nombre, s, ms) {
  $("resNombre").textContent = nombre;
  $("resMeta").textContent = `${s.paginas} página(s) · ${(ms / 1000).toFixed(1)} s`;
  const filas = [
    ["principal", `${cfg.nombrePrincipal} (${cfg.clubPrincipal})`, s.principal],
    ["otrosClub1", `Otros ${cfg.clubPrincipal}`, s.otrosClub1],
    ["otrosClub2", `Otros ${cfg.clubOtros}`, s.otrosClub2],
    ["celeste", "Lista celeste (col. A)", s.celeste],
    ["verde", "Lista verde (col. B)", s.verde],
  ];
  $("resStats").innerHTML = filas.map(([k, t, n]) =>
    `<li><span class="sw" style="background:${rgb(COLORES[k])}"></span><span>${esc(t)}</span><b>${n}</b></li>`).join("");
  const puedeCompartir = !!(navigator.canShare && navigator.canShare({ files: [resultado.file] }));
  $("btnCompartir").hidden = !puedeCompartir;
  $("resultado").hidden = false;
  if (s.principal === 0 && s.paginas) $("resAviso").textContent = `Ojo: no encontré "${cfg.nombrePrincipal}" junto a ${cfg.clubPrincipal} en este PDF.`;
  else $("resAviso").textContent = "";
  $("resultado").scrollIntoView({ behavior: "smooth", block: "start" });
}

const rgb = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(",")})`;

function mostrarError(msg) { $("error").textContent = msg; $("error").hidden = false; }

function descargar() {
  const a = document.createElement("a");
  a.href = resultado.url; a.download = resultado.file.name;
  document.body.appendChild(a); a.click(); a.remove();
}

async function compartir() {
  try { await navigator.share({ files: [resultado.file], title: resultado.file.name }); }
  catch (e) { if (e.name !== "AbortError") descargar(); }
}

// ---------------- Ajustes ----------------
function pintarAjustes() {
  for (const k of Object.keys(DEFAULTS)) $(`cfg_${k}`).value = cfg[k];
  $("leyPrincipal").textContent = `${cfg.nombrePrincipal} en ${cfg.clubPrincipal}`;
  $("leyClub1").textContent = `Otros de ${cfg.clubPrincipal}`;
  $("leyClub2").textContent = `Otros de ${cfg.clubOtros}`;
}

function guardarAjustes(ev) {
  ev.preventDefault();
  const prevUrl = cfg.sheetUrl;
  for (const k of Object.keys(DEFAULTS)) {
    const v = $(`cfg_${k}`).value.trim();
    cfg[k] = typeof DEFAULTS[k] === "number" ? (Number(v) || DEFAULTS[k]) : (v || DEFAULTS[k]);
  }
  store.set(LS_CFG, cfg); pintarAjustes();
  $("cfgOk").textContent = "Guardado ✓"; setTimeout(() => ($("cfgOk").textContent = ""), 2000);
  if (cfg.sheetUrl !== prevUrl) cargarListas();
}

function restaurar() { cfg = { ...DEFAULTS }; store.set(LS_CFG, cfg); pintarAjustes(); cargarListas(); }

// ---------------- PDF compartido desde otra app (Android) ----------------
async function revisarCompartido() {
  if (!new URLSearchParams(location.search).has("compartido")) return;
  history.replaceState(null, "", "./");
  try {
    const c = await caches.open("sombreado-share");
    const r = await c.match("shared.pdf");
    if (!r) return;
    const name = decodeURIComponent(r.headers.get("X-Name") || "programa.pdf");
    const blob = await r.blob();
    await c.delete("shared.pdf");
    procesar(new File([blob], name, { type: "application/pdf" }));
  } catch (e) { console.error(e); }
}

// ---------------- Inicio ----------------
function init() {
  $("archivo").addEventListener("change", (e) => procesar(e.target.files[0]));
  const drop = $("zona");
  ["dragover", "dragenter"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("over")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); procesar(e.dataTransfer.files[0]); });
  $("btnListas").addEventListener("click", cargarListas);
  $("btnDescargar").addEventListener("click", descargar);
  $("btnCompartir").addEventListener("click", compartir);
  $("btnVer").addEventListener("click", () => window.open(resultado.url, "_blank"));
  $("formCfg").addEventListener("submit", guardarAjustes);
  $("btnRestaurar").addEventListener("click", restaurar);

  pintarAjustes(); pintarListas();
  if (navigator.onLine) cargarListas();

  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (ios && !standalone) $("tipIOS").hidden = false;

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").then(revisarCompartido, revisarCompartido);
  else revisarCompartido();

  // Precarga el motor cuando la app esté ociosa
  setTimeout(() => motor().catch(() => {}), 1500);
}

init();
