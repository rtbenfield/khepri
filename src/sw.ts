/// <reference lib="webworker" />
export {}; // Tells TypeScript to force this into a module
declare var self: ServiceWorkerGlobalScope;

self.addEventListener("install", (e) => {
  console.debug("SW: install", e);
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  console.debug("SW: activate", e);
});

self.addEventListener("fetch", (e) => {
  console.debug("SW: fetch", e);
  e.respondWith(handleFetch(e));
});

async function handleFetch(e: FetchEvent): Promise<Response> {
  const filesystem = await caches.open("filesystem");
  const match = await filesystem.match(e.request);
  return match ?? fetch(e.request);
}
