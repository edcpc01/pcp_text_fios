import { useState, useEffect, useRef } from 'react';
import { Download, WifiOff, RefreshCw, X } from 'lucide-react';

export default function PWAPrompt() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showInstall, setShowInstall] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const deferredPrompt = useRef(null);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const handler = (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
      if (!dismissed) setTimeout(() => setShowInstall(true), 3000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setShowInstall(false); deferredPrompt.current = null; });

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [dismissed]);

  const install = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setShowInstall(false);
    if (outcome !== 'accepted') setDismissed(true);
  };

  return (
    <>
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-amber-500/95 backdrop-blur-sm px-4 py-2 text-sm font-medium text-amber-950 animate-slide-down">
          <WifiOff size={14} />
          <span>Sem conexão — modo offline ativo</span>
        </div>
      )}

      {showInstall && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[calc(100vw-2rem)] max-w-sm animate-slide-up">
          <div className="relative bg-brand-slate border border-amber-500/25 rounded-2xl p-4 shadow-2xl shadow-black/50">
            <button onClick={() => { setShowInstall(false); setDismissed(true); }}
              className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 transition-colors">
              <X size={14} />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shrink-0">
                <Download size={18} className="text-amber-950" />
              </div>
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-sm font-semibold text-slate-100">Instalar app</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Acesse o planejamento direto na tela inicial.
                </p>
              </div>
            </div>
            <button onClick={install}
              className="mt-3 w-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold text-sm rounded-xl py-2.5 transition-colors">
              Instalar agora
            </button>
          </div>
        </div>
      )}
    </>
  );
}
