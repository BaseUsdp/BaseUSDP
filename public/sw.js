// Minimal service worker for PWA install eligibility.
// No caching / offline logic yet — that's a separate feature. This is just
// the smallest possible SW that satisfies the browser's "this is a real
// PWA" check so the install prompt becomes available.

self.addEventListener("install", () => {
  // Take over immediately on first install so the install prompt can fire
  // without a reload.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// No-op fetch handler. Required for the browser to consider the page a
// fully-functional PWA in some installability checks.
self.addEventListener("fetch", () => {
  // pass-through — let the network handle everything
});
