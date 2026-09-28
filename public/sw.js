/*
 * LexScore Service Worker
 *
 * 策略：stale-while-revalidate。
 *   - 有缓存就先返回缓存，同时后台拉新版本写回缓存（下次访问即最新）
 *   - 没有缓存就走网络
 *   - 断网且无缓存时，导航请求回落到缓存的首页
 *
 * 因为整个应用是静态导出 + 引擎跑在客户端，只要外壳被缓存过，
 * 断网也能完整批改。首次访问仍需联网。
 */

const CACHE = "lexscore-v1";

/** 首次安装时预缓存应用外壳，保证离线也能打开任意页面 */
const SHELL = ["/", "/report/", "/corpus/", "/manifest.webmanifest", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {
        /* 单个资源失败不影响安装 */
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // 只处理同源 GET
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);

      const fromNetwork = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(async () => {
          if (cached) return cached;
          // 导航请求断网时回落到缓存的首页
          if (request.mode === "navigate") {
            const shell = await cache.match("/");
            if (shell) return shell;
          }
          return new Response("离线且无缓存", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        });

      return cached || fromNetwork;
    }),
  );
});
