/**
 * FirebaseStatus — mostra banner de alerta quando as variáveis
 * VITE_FIREBASE_* não estão configuradas (ambiente de produção sem .env)
 */
import { useState, useEffect } from 'react';
import { AlertTriangle, X, ExternalLink } from 'lucide-react';

export default function FirebaseStatus() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const key = import.meta.env.VITE_FIREBASE_API_KEY;
    // Se a chave não existe ou é o placeholder do .env.example
    if (!key || key === 'your_api_key_here') {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] w-[calc(100vw-2rem)] max-w-lg animate-slide-up">
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-300">Firebase não configurado</p>
            <p className="text-xs text-amber-400/80 mt-0.5 leading-relaxed">
              Os dados não serão salvos. Configure as variáveis{' '}
              <code className="font-mono bg-amber-500/20 px-1 rounded">VITE_FIREBASE_*</code>{' '}
              no painel da Vercel.
            </p>
            <a href="https://vercel.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200 mt-1.5 transition-colors">
              Abrir Vercel <ExternalLink size={10} />
            </a>
          </div>
          <button onClick={() => setShow(false)} className="text-amber-500 hover:text-amber-300 p-0.5 transition-colors shrink-0">
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
