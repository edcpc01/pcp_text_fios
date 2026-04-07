import { useState, useEffect } from 'react';
import { Download, WifiOff, RefreshCw, X, Smartphone, Zap } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';

// ─── Banner de Instalação ─────────────────────────────────────────────────────
function InstallBanner({ onInstall, onDismiss }) {
  const [visible, setVisible] = useState(false);

  // Atraso de 2s para não aparecer imediatamente
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[90]
      w-[calc(100vw-2rem)] max-w-sm animate-slide-up">
      <div className="relative bg-brand-card border border-brand-cyan/20 rounded-2xl p-4 shadow-2xl shadow-black/60
        backdrop-blur-sm">

        <button onClick={onDismiss}
          className="absolute top-3 right-3 text-brand-muted hover:text-white transition-colors p-0.5">
          <X size={14} />
        </button>

        <div className="flex items-start gap-3 pr-4">
          {/* Ícone */}
          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-lg">
            <svg viewBox="0 0 64 64" width="48" height="48" xmlns="http://www.w3.org/2000/svg">
              <rect width="64" height="64" rx="12" fill="#06b6d4"/>
              <text x="32" y="28" fontFamily="Georgia,'Times New Roman',serif" fontSize="30" fontWeight="700"
                fontStyle="italic" fill="white" textAnchor="middle" dominantBaseline="middle">D</text>
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
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-brand-cyan text-brand-bg
              text-xs font-bold rounded-xl hover:bg-cyan-400 transition-colors">
            <Download size={13} />
            Instalar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Banner de Atualização ────────────────────────────────────────────────────
function UpdateBanner({ onUpdate, onDismiss }) {
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[90]
      w-[calc(100vw-2rem)] max-w-sm animate-slide-down">
      <div className="relative bg-brand-card border border-brand-success/30 rounded-2xl px-4 py-3 shadow-2xl shadow-black/60
        backdrop-blur-sm flex items-center gap-3">

        <div className="w-8 h-8 rounded-lg bg-brand-success/10 flex items-center justify-center shrink-0">
          <Zap size={15} className="text-brand-success" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white leading-tight">Nova versão disponível</p>
          <p className="text-[10px] text-brand-muted mt-0.5">Atualize para obter as últimas melhorias.</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onDismiss}
            className="p-1 text-brand-muted hover:text-white transition-colors">
            <X size={13} />
          </button>
          <button onClick={onUpdate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-success/10 border border-brand-success/30
              text-brand-success text-xs font-bold rounded-xl hover:bg-brand-success/20 transition-colors">
            <RefreshCw size={12} />
            Atualizar
          </button>
        </div>
      </div>
    </div>
  );
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
  const { isInstallable, isOffline, isUpdateAvailable, install, update } = usePWA();

  const [installDismissed, setInstallDismissed] = useState(() =>
    sessionStorage.getItem('pwa-install-dismissed') === '1'
  );
  const [updateDismissed, setUpdateDismissed] = useState(false);

  const handleInstall = async () => {
    const accepted = await install();
    if (!accepted) setInstallDismissed(true);
  };

  const handleInstallDismiss = () => {
    setInstallDismissed(true);
    sessionStorage.setItem('pwa-install-dismissed', '1');
  };

  const handleUpdate = () => update();

  return (
    <>
      {isOffline && <OfflineBanner />}

      {isUpdateAvailable && !updateDismissed && (
        <UpdateBanner onUpdate={handleUpdate} onDismiss={() => setUpdateDismissed(true)} />
      )}

      {isInstallable && !installDismissed && !isUpdateAvailable && (
        <InstallBanner onInstall={handleInstall} onDismiss={handleInstallDismiss} />
      )}
    </>
  );
}
