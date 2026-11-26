self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "QA Start", {
      body: data.body || "Новое уведомление",
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { link: data.link || "/dashboard" },
      icon: "/favicon.svg",
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.link || "/dashboard", self.location.origin)
    .href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(targetUrl);
          return;
        }
      }
      return clients.openWindow(targetUrl);
    }),
  );
});
