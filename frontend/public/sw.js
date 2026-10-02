// Shows reminder alerts the server pushes, even with every app tab closed.

// Take over open tabs at once, so a click can steer them without a reload first.
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
    const data = event.data ? event.data.json() : {};
    event.waitUntil(
        // The tag is the reminder's id: an open tab's own alert for it is replaced, not doubled.
        self.registration.showNotification(data.title || "Reminder", {
            body: data.body,
            tag: data.tag,
            data: { url: data.url || "/chat" },
        }),
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = new URL(event.notification.data?.url || "/chat", self.location.origin).href;
    event.waitUntil(
        (async () => {
            const [tab] = await self.clients.matchAll({ type: "window" });
            if (!tab) return self.clients.openWindow(url);
            await tab.focus();
            if (tab.url !== url) await tab.navigate(url);
        })(),
    );
});
