import PWAPrompt from './PWAPrompt';
/**
 * PWAPrompt — Componente que exibe:
 *  1. Banner de instalação (A2HS) quando o app pode ser instalado
 *  2. Toast de "sem conexão" quando offline
 *  3. Toast de "nova versão disponível" quando SW atualiza
 *
 * Adicione ao Layout.jsx logo dentro do <div> raiz.
 */

import { useState, useEffect } from 'react';
import { Download, WifiOff, RefreshCw, X } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';

export default function PWAPrompt() {
  const { isInstallable, isOffline, isUpdateAvailable, install, update } = usePWA();
  const [showInstall, setShowInstall] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Mostrar banner de instalação após 3 segundos (não imediatamente)
  useEffect(() => {
    if (isInstallable && !dismissed) {
      const t = setTimeout(() => setShowInstall(true), 3000);
      return () => clearTimeout(t);
    }
    if (!isInstallable) setShowInstall(false);
  }, [isInstallable, dismissed]);

  const handleInstall = async () => {
    const accepted = await install();
    if (!accepted) {
      setShowInstall(false);
      setDismissed(true);
    }
  };

  return (
    <>
      {/* ─── Offline indicator ─────────────────────────────────────────────── */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-amber-500/95 backdrop-blur-sm px-4 py-2 text-sm font-medium text-amber-950 animate-slide-down">
          <WifiOff size={14} />
          <span>Sem conexão — modo offline ativo</span>
        </div>
      )}

      {/* ─── Update available toast ────────────────────────────────────────── */}
      {isUpdateAvailable && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-brand-slate border border-sky-500/30 rounded-xl px-4 py-3 shadow-2xl shadow-black/40 animate-slide-up">
          <RefreshCw size={15} className="text-sky-400 shrink-0" />
          <span className="text-sm text-slate-200">Nova versão disponível</span>
          <button
            onClick={update}
            className="ml-1 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors underline underline-offset-2"
          >
            Atualizar
          </button>
        </div>
      )}

      {/* ─── Install banner ────────────────────────────────────────────────── */}
      {showInstall && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[calc(100vw-2rem)] max-w-sm animate-slide-up">
          <div className="relative bg-brand-slate border border-amber-500/25 rounded-2xl p-4 shadow-2xl shadow-black/50">
            <button
              onClick={() => { setShowInstall(false); setDismissed(true); }}
              className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X size={14} />
            </button>

            <div className="flex items-start gap-3">
              {/* Ícone */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shrink-0">
                <Download size={18} className="text-amber-950" />
              </div>

              <div className="flex-1 min-w-0 pr-4">
                <p className="text-sm font-semibold text-slate-100">Instalar app</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Acesse o planejamento diretamente na tela inicial, sem abrir o navegador.
                </p>
              </div>
            </div>

            <button
              onClick={handleInstall}
              className="mt-3 w-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-amber-950 font-semibold text-sm rounded-xl py-2.5 transition-colors"
            >
              Instalar agora
            </button>
          </div>
          <PWAPrompt />
        </div>
      )}
    </>
  );
}
