// 최소 SW: 앱 셸·아이콘 캐시 + 오프라인 폴백
// /api/* 와 /uploads/* 는 절대 캐시하지 않는다 (인증·데이터 오염 방지)
const CACHE = "rk-hub-v2";
const CORE = ["/", "/login", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/logo.svg"];
const NO_CACHE_PREFIX = ["/api/", "/uploads/"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NO_CACHE_PREFIX.some((p) => url.pathname.startsWith(p))) return;
  if (request.mode === "navigate") {
    e.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }
  e.respondWith(
    caches.match(request).then(
      (hit) => hit || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      })
    )
  );
});
