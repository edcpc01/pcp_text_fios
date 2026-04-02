import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, X, RefreshCw } from 'lucide-react';
import { db, auth } from '../services/firebase';
import { collection, addDoc, getDocs, query, limit, Timestamp } from 'firebase/firestore';

export default function FirebaseStatus() {
  const [status, setStatus] = useState('idle'); // idle | checking | ok | error
  const [message, setMessage] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const checkConnection = async () => {
    setStatus('checking');
    try {
      // Test: escreve e lê um doc de teste
      const testRef = collection(db, '_connection_test');
      await addDoc(testRef, { ts: Timestamp.now(), uid: auth.currentUser?.uid || 'anon' });
      const snap = await getDocs(query(testRef, limit(1)));
      if (snap.size > 0) {
        setStatus('ok');
        setMessage('Firestore conectado — dados serão persistidos!');
        setTimeout(() => setDismissed(true), 3000);
      }
    } catch (err) {
      setStatus('error');
      setMessage(`Erro: ${err.code || err.message}`);
    }
  };

  useEffect(() => {
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    if (!apiKey || apiKey === 'your_api_key_here') {
      setStatus('error');
      setMessage('Variáveis VITE_FIREBASE_* não configuradas na Vercel.');
      return;
    }
    // Auto-check after 2s (let auth initialize)
    const t = setTimeout(checkConnection, 2000);
    return () => clearTimeout(t);
  }, []);

  if (dismissed || status === 'idle') return null;

  const colors = {
    checking: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300', icon: <RefreshCw size={15} className="text-blue-400 animate-spin" /> },
    ok:       { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', icon: <CheckCircle size={15} className="text-emerald-400" /> },
    error:    { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300', icon: <AlertTriangle size={15} className="text-red-400" /> },
  };
  const c = colors[status] || colors.checking;

  return (
    <div className="fixed bottom-4 right-4 z-[200] max-w-sm animate-slide-up">
      <div className={`${c.bg} border ${c.border} rounded-xl px-4 py-3 shadow-2xl backdrop-blur-sm flex items-start gap-3`}>
        <div className="shrink-0 mt-0.5">{c.icon}</div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold ${c.text}`}>
            {status === 'checking' ? 'Verificando conexão Firebase...' :
             status === 'ok'       ? 'Firebase OK' : 'Firebase com problema'}
          </p>
          {message && <p className="text-xs text-brand-muted mt-0.5 leading-relaxed">{message}</p>}
          {status === 'error' && (
            <div className="mt-2 space-y-1">
              <p className="text-[10px] text-brand-muted">Verifique no Firestore Console:</p>
              <p className="text-[10px] text-brand-muted">1. Regras publicadas (aba Regras)</p>
              <p className="text-[10px] text-brand-muted">2. Índices ativos (aba Índices)</p>
              <button onClick={checkConnection}
                className="mt-1.5 text-[10px] text-red-300 hover:text-red-200 underline underline-offset-2">
                Tentar novamente
              </button>
            </div>
          )}
        </div>
        <button onClick={() => setDismissed(true)} className="text-brand-muted hover:text-white p-0.5 transition-colors shrink-0">
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
