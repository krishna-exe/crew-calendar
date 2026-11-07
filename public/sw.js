// Shows reminder notifications and opens the right page when one is tapped. It has no
// fetch handler on purpose: the site always loads fresh, so nothing can go stale.

self.addEventListener('push', (event) => {
  const { body = 'Time to check in.', url = '/' } = event.data?.json() ?? {}
  event.waitUntil(self.registration.showNotification('Crew Calendar', {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'daily-reminder',
    data: { url },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const { url } = event.notification.data
  event.waitUntil((async () => {
    const [open] = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (!open) return self.clients.openWindow(url)
    await open.focus()
    return open.navigate(url)
  })())
})
