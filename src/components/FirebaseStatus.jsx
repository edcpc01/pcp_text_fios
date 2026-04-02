import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, X, RefreshCw } from 'lucide-react';
import { db, auth } from '../services/firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

export default function FirebaseStatus() {
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const check = async () => {
    setStatus('checking');
    try {
      // Tenta escrever no próprio documento do usuário (sempre permitido pelas regras)
      const uid = auth.currentUser?.uid;
      if (!uid) {
        setStatus('error');
        setMessage('Usuário não autenticado.');
        return;
      }
      await setDoc(doc(db, 'users', uid), {
        lastSeen: Timestamp.now(),
        email: auth.currentUser?.email || '',
      }, { merge: true });
      setStatus('ok');
      setMessage('Conectado! Dados serão salvos.');
      setTimeout(() => setDismissed(true), 3000);
    } catch (err) {
      setStatus('error');
      setMessage(`${err.code}: ${err.message}`);
    }
  };

  useEffect(() => {
    const t = setTimeout(check, 2500);
    return () => clearTimeout(t);
  }, []);

  if (dismissed) return null;

  const styles = {
    checking: { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-300', icon: <RefreshCw size={14} className="text-blue-400 animate-spin shrink-0" /> },
    ok:       { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-300', icon: <CheckCircle size={14} className="text-emerald-400 shrink-0" /> },
    error:    { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-300', icon: <AlertTriangle size={14} className="text-red-400 shrink-0" /> },
  };
  const s = styles[status];

  return (
    <div className="fixed bottom-4 right-4 z-[200] w-72 animate-slide-up">
      <div className={`border rounded-xl px-3.5 py-3 shadow-2xl backdrop-blur-sm flex items-start gap-2.5 ${s.bg}`}>
        {s.icon}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold ${s.text}`}>
            {status === 'checking' ? 'Verificando Firebase...' : status === 'ok' ? 'Firebase OK' : 'Firebase: erro'}
          </p>
          {message && <p className="text-[11px] text-brand-muted mt-0.5 break-all">{message}</p>}
          {status === 'error' && (
            <>
              <p className="text-[10px] text-brand-muted mt-1.5 leading-relaxed">
                Abra o Firebase Console → Firestore → Regras e cole a regra simplificada do arquivo <code className="font-mono">firestore.rules</code>.
              </p>
              <button onClick={check} className="text-[11px] text-red-300 hover:text-red-200 underline underline-offset-2 mt-1.5">
                Tentar novamente
              </button>
            </>
          )}
        </div>
        <button onClick={() => setDismissed(true)} className="text-brand-muted hover:text-white p-0.5 shrink-0"><X size={12} /></button>
      </div>
    </div>
  );
}
