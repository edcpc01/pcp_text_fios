import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// ── Precache (Workbox injeta o manifesto aqui automaticamente) ─────────────────
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ── Estratégia agressiva: skipWaiting imediatamente ao instalar ───────────────
// Isso garante que o novo SW assume o controle mesmo que o antigo não coopere.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

// ── Assume todos os clientes abertos assim que ativa ─────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Listener de mensagem: compatibilidade com SW antigos ─────────────────────
// (fallback caso algum cliente ainda mande SKIP_WAITING manualmente)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
