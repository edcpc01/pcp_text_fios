import { useState, useEffect, useRef } from 'react';
import { Download, WifiOff, RefreshCw, X, Zap, Share } from 'lucide-react';

// ─── Banner de Atualização ────────────────────────────────────────────────────
function UpdateBanner({ onUpdate, onDismiss }) {
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[90]
      w-[calc(100vw-2rem)] max-w-sm animate-slide-down">
      <div className="relative bg-brand-card border border-brand-success/30 rounded-2xl px-4 py-3
        shadow-2xl shadow-black/60 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-success/10 flex items-center justify-center shrink-0">
          <Zap size={15} className="text-brand-success" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white leading-tight">App atualizado</p>
          <p className="text-[10px] text-brand-muted mt-0.5">Recarregue para usar a nova versão.</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onDismiss} className="p-1 text-brand-muted hover:text-white transition-colors">
            <X size={13} />
          </button>
          <button onClick={onUpdate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-success/10 border border-brand-success/30
              text-brand-success text-xs font-bold rounded-xl hover:bg-brand-success/20 transition-colors">
            <RefreshCw size={12} />
            Recarregar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Banner de Instalação (Android/Chrome) ────────────────────────────────────
function InstallBanner({ onInstall, onDismiss }) {
  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[90]
      w-[calc(100vw-2rem)] max-w-sm animate-slide-up">
      <div className="relative bg-brand-card border border-brand-cyan/20 rounded-2xl p-4
        shadow-2xl shadow-black/60">
        <button onClick={onDismiss}
          className="absolute top-3 right-3 text-brand-muted hover:text-white transition-colors">
          <X size={14} />
        </button>
        <div className="flex items-start gap-3 pr-4">
          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-lg">
            <svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg">
              <rect width="64" height="64" rx="12" fill="#06b6d4"/>
              <text x="32" y="28" fontFamily="Georgia,'Times New Roman',serif" fontSize="30"
                fontWeight="700" fontStyle="italic" fill="white" textAnchor="middle" dominantBaseline="middle">D</text>
              <g transform="translate(32,54)" fill="none" stroke="white" strokeLinecap="round"
                strokeLinejoin="round" strokeWidth="1.6">
                <rect x="-15" y="-10" width="30" height="11" rx="1" fill="#06b6d4" stroke="white" strokeWidth="1.4"/>
                <rect x="-12" y="-18" width="5" height="9"  rx="0.8" fill="#06b6d4" stroke="white" strokeWidth="1.3"/>
                <rect x="-3"  y="-22" width="5" height="13" rx="0.8" fill="#06b6d4" stroke="white" strokeWidth="1.3"/>
                <rect x="7"   y="-16" width="5" height="7"  rx="0.8" fill="#06b6d4" stroke="white" strokeWidth="1.3"/>
                <rect x="-11" y="-6"  width="4" height="4" rx="0.5" fill="white" stroke="none"/>
                <rect x="-3"  y="-6"  width="4" height="4" rx="0.5" fill="white" stroke="none"/>
                <rect x="5"   y="-6"  width="4" height="4" rx="0.5" fill="white" stroke="none"/>
              </g>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-tight">Instalar PCP Fios</p>
            <p className="text-xs text-brand-muted mt-1 leading-relaxed">
              Acesse o planejamento direto na tela inicial, mesmo sem internet.
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={onDismiss}
            className="flex-1 py-2 text-xs text-brand-muted hover:text-white border border-brand-border rounded-xl transition-colors">
            Agora não
          </button>
          <button onClick={onInstall}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-brand-cyan
              text-brand-bg text-xs font-bold rounded-xl hover:bg-cyan-400 transition-colors">
            <Download size={13} />
            Instalar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Banner de Instalação (iOS) ──────────────────────────────────────────────
function IOSInstallBanner({ onDismiss }) {
  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[90]
      w-[calc(100vw-2rem)] max-w-sm animate-slide-up">
      <div className="relative bg-brand-card border border-brand-cyan/20 rounded-2xl p-5
        shadow-2xl shadow-black/60">
        <button onClick={onDismiss}
          className="absolute top-3 right-3 text-brand-muted hover:text-white transition-colors">
          <X size={14} />
        </button>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-cyan/10 flex items-center justify-center shrink-0 border border-brand-cyan/20">
              <Share size={24} className="text-brand-cyan" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Instalar no iPhone</p>
              <p className="text-[11px] text-brand-muted mt-0.5">Siga os passos abaixo:</p>
            </div>
          </div>
          <div className="space-y-3 px-1">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-brand-cyan shrink-0 border border-white/10 mt-0.5">1</div>
              <p className="text-[11px] text-brand-muted leading-relaxed">
                Toque no ícone de <span className="text-white font-semibold">Compartilhar</span> (quadrado com seta para cima) na barra inferior do Safari.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-brand-cyan shrink-0 border border-white/10 mt-0.5">2</div>
              <p className="text-[11px] text-brand-muted leading-relaxed">
                Role a lista e toque em <span className="text-white font-semibold">Adicionar à Tela de Início</span>.
              </p>
            </div>
          </div>
          <button onClick={onDismiss}
            className="w-full py-2.5 mt-1 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-bold rounded-xl hover:bg-brand-cyan/20 transition-colors">
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DISMISS_KEY = 'pwa-install-dismissed-at';
const SEVEN_DAYS  = 7 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function getIsIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// ─── Banner Offline ───────────────────────────────────────────────────────────
function OfflineBanner() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2
      bg-amber-500/95 backdrop-blur-sm px-4 py-2 text-sm font-medium text-amber-950 animate-slide-down">
      <WifiOff size={14} />
      <span>Sem conexão — modo offline ativo</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PWAPrompt() {
  const [isOffline,     setIsOffline]     = useState(!navigator.onLine);
  const [showUpdate,    setShowUpdate]    = useState(false);
  const [showInstall,   setShowInstall]   = useState(false);
  const [showIOSInstall,setShowIOSInstall]= useState(false);
  const deferredPrompt  = useRef(null);
  // Rastreia se o SW mudou enquanto o app estava em background
  const swUpdatedInBg   = useRef(false);

  // ── Detecção de atualização do Service Worker ─────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // 1) controllerchange: novo SW assumiu o controle
    //    - Se a página está visível → mostra banner
    //    - Se está em background → marca flag; ao voltar ao foreground recarrega silenciosamente
    const onControllerChange = () => {
      if (document.visibilityState === 'visible') {
        setShowUpdate(true);
      } else {
        swUpdatedInBg.current = true;
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // 2) Ao voltar ao foreground: se o SW mudou em background, recarrega direto
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && swUpdatedInBg.current) {
        window.location.reload();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // 3) Verifica na registration: novo SW em waiting OU updatefound futuro
    const watchRegistration = (reg) => {
      if (!reg) return;

      // SW já estava esperando quando a página abriu
      if (reg.waiting && navigator.serviceWorker.controller) {
        setShowUpdate(true);
      }

      // Monitora futuras atualizações
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setShowUpdate(true);
          }
        });
      });
    };

    navigator.serviceWorker.getRegistration().then(watchRegistration);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // ── Online/Offline ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onOnline  = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ── Lógica de exibição de instalação ────────────────────────────────────────
  useEffect(() => {
    if (isStandalone() || checkDismissed()) return;

    if (getIsIOS()) {
      const timer = setTimeout(() => setShowIOSInstall(true), 5000);
      return () => clearTimeout(timer);
    }

    if (window.pwaDeferredPrompt) {
      deferredPrompt.current = window.pwaDeferredPrompt;
      const timer = setTimeout(() => setShowInstall(true), 3000);
      return () => clearTimeout(timer);
    }

    const handler = (e) => {
      e.preventDefault();
      deferredPrompt.current = e;
      window.pwaDeferredPrompt = e;
      setTimeout(() => setShowInstall(true), 3000);
    };
    const onInstalled = () => {
      setShowInstall(false);
      deferredPrompt.current = null;
      window.pwaDeferredPrompt = null;
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function checkDismissed() {
    const t = localStorage.getItem(DISMISS_KEY);
    return t && (Date.now() - parseInt(t, 10)) < SEVEN_DAYS;
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleUpdate = async () => {
    setShowUpdate(false);
    if (!('serviceWorker' in navigator)) { window.location.reload(); return; }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) {
        // Diz ao SW em espera para assumir o controle imediatamente
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        // controllerchange vai disparar e acionar o reload; fallback após 1.5s
        const fallback = setTimeout(() => window.location.reload(), 1500);
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          clearTimeout(fallback);
          window.location.reload();
        }, { once: true });
      } else {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };

  const handleInstall = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setShowInstall(false);
    if (outcome !== 'accepted') {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    }
  };

  const handleDismiss = () => {
    setShowInstall(false);
    setShowIOSInstall(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  };

  return (
    <>
      {isOffline && <OfflineBanner />}

      {showUpdate && (
        <UpdateBanner
          onUpdate={handleUpdate}
          onDismiss={() => setShowUpdate(false)}
        />
      )}

      {showInstall && !showUpdate && (
        <InstallBanner
          onInstall={handleInstall}
          onDismiss={handleDismiss}
        />
      )}

      {showIOSInstall && !showUpdate && (
        <IOSInstallBanner
          onDismiss={handleDismiss}
        />
      )}
    </>
  );
}
