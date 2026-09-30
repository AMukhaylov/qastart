self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "QA Start", {
      body: data.body || "Новое уведомление",
      data: { link: data.link || "/dashboard" },
      icon: "/favicon.svg",
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.link || "/dashboard"));
});
