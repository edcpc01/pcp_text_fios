/**
 * usePWA — Hook para gerenciar PWA install prompt e SW updates
 *
 * Uso:
 *   const { isInstallable, isOffline, isUpdateAvailable, install, update } = usePWA();
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function usePWA() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const deferredPrompt = useRef(null);

  // vite-plugin-pwa auto-register com callback de update
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('[PWA] Service Worker registrado:', r);
    },
    onRegisterError(error) {
      console.error('[PWA] Erro ao registrar SW:', error);
    },
  });

  // Install prompt (A2HS)
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstallable(false);
      deferredPrompt.current = null;
      console.log('[PWA] App instalado com sucesso');
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Online / offline
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt.current) return false;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setIsInstallable(false);
    return outcome === 'accepted';
  }, []);

  const update = useCallback(() => {
    updateServiceWorker(true);
    setNeedRefresh(false);
  }, [updateServiceWorker, setNeedRefresh]);

  return {
    isInstallable,
    isOffline,
    isUpdateAvailable: needRefresh,
    install,
    update,
  };
}
