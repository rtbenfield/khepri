/// <reference lib="webworker" />
export {}; // Tells TypeScript to force this into a module
declare var self: ServiceWorkerGlobalScope;

const logger = console;

self.addEventListener("install", () => {
  logger.debug("[SW] install");
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  logger.debug("[SW] activate");
});

self.addEventListener("fetch", (e) => {
  if (e.request.url.includes("~/")) {
    logger.debug(`[SW] fetch ${e.request.method} ${e.request.url}`);
    e.respondWith(handleFetch(e));
  }
});

async function handleFetch(e: FetchEvent): Promise<Response> {
  const filesystem = await caches.open("khepri");
  const match = await filesystem.match(
    // TODO: Find a better way to handle this
    new Request(e.request.url.replace("/dist/~", "")),
  );
  return match ?? fetch(e.request);
}
