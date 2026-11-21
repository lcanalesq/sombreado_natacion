// Service worker: offline + recibir PDFs compartidos (Android "Compartir con…")
const VERSION = "v1.0.0";
const CACHE = `sombreado-${VERSION}`;
const SHARE_CACHE = "sombreado-share";
const ASSETS = [
  "./", "./index.html", "./app.js", "./sombrear.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png",
  "./vendor/mupdf/mupdf.js", "./vendor/mupdf/mupdf-wasm.js", "./vendor/mupdf/mupdf-wasm.wasm",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== SHARE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // PDF compartido desde otra app
  if (e.request.method === "POST" && url.pathname.endsWith("/share-target")) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const file = form.get("pdf");
        if (file) {
          const c = await caches.open(SHARE_CACHE);
          await c.put("shared.pdf", new Response(file, { headers: { "X-Name": encodeURIComponent(file.name || "programa.pdf") } }));
        }
      } catch (_) {}
      return Response.redirect("./?compartido=1", 303);
    })());
    return;
  }

  if (e.request.method !== "GET") return;

  // Google Sheets: siempre a la red (las listas cambian)
  if (url.origin !== location.origin) return;

  // Archivos propios: cache primero, red como respaldo
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request))
  );
});
