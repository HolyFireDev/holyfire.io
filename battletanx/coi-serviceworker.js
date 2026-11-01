/* Adds the cross-origin isolation headers GitHub Pages cannot send, so the
   browser allows SharedArrayBuffer and the emulator can run multi-threaded.
   Based on the coi-serviceworker pattern (gzuidhof), trimmed. */
if (typeof window === "undefined") {
  self.addEventListener("install", function () { self.skipWaiting(); });
  self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
  self.addEventListener("fetch", function (e) {
    var r = e.request;
    if (r.cache === "only-if-cached" && r.mode !== "same-origin") return;
    e.respondWith(fetch(r).then(function (res) {
      if (res.status === 0) return res;
      var h = new Headers(res.headers);
      h.set("Cross-Origin-Embedder-Policy", "credentialless");
      h.set("Cross-Origin-Opener-Policy", "same-origin");
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
    }));
  });
} else {
  (function () {
    if (window.crossOriginIsolated || !("serviceWorker" in navigator) || sessionStorage.getItem("coi-off")) return;
    var key = "coi-reloaded";
    navigator.serviceWorker.register(document.currentScript.src).then(function (reg) {
      if (reg.active && !navigator.serviceWorker.controller && !sessionStorage.getItem(key)) { sessionStorage.setItem(key, "1"); location.reload(); return; }
      reg.addEventListener("updatefound", function () { var w = reg.installing; if (!w) return; w.addEventListener("statechange", function () { if (w.state === "activated" && !sessionStorage.getItem(key)) { sessionStorage.setItem(key, "1"); location.reload(); } }); });
    }).catch(function () {});
  })();
}
