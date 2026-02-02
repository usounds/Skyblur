// Minimal Service Worker for PWA installability
// We act as a passthrough to ensure the browser sees a 'fetch' handler.

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Just pass the request through. 
    // This satisfies the PWA requirement "Has a registered service worker with a fetch event handler"
    // without risking cache failures.
    return;
});
