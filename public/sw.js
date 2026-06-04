// Minimal service worker — supports PWA install + Web Push tip notifications.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// No-op fetch handler — present so the browser counts us as a fully
// installable PWA. We don't intercept anything; the network handles all
// requests directly.
self.addEventListener("fetch", () => {});

// Push tip notifications. Payload is JSON sent by /api/cron/push-tips:
//   { title, body, url, tag }
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    try {
      payload = { title: "BASEUSDP", body: event.data.text() };
    } catch {
      payload = { title: "BASEUSDP", body: "You have a new notification" };
    }
  }
  const title = payload.title || "BASEUSDP";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: payload.url || "/dashboard" },
    tag: payload.tag || "baseusdp-notification",
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Clicking a notification focuses an existing tab if there is one, or
// opens a new one to the payload's url.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return null;
      }),
  );
});
