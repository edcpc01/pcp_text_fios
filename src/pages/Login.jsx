import { useState } from 'react';
import { useAuthStore } from '../hooks/useStore';
import { signIn } from '../services/firebase';
import { Eye, EyeOff, Factory, AlertCircle } from 'lucide-react';

export default function Login() {
  const { setUser, setLoading, setError, error, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const result = await signIn(email, password);
      setUser({ uid: result.user.uid, email: result.user.email, name: result.user.displayName || result.user.email.split('@')[0], role: 'planner' });
    } catch (err) {
      const msgs = {
        'auth/invalid-credential': 'E-mail ou senha incorretos.',
        'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.',
        'auth/network-request-failed': 'Sem conexão.',
      };
      setError(msgs[err.code] || 'Erro ao entrar. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: 'linear-gradient(rgba(34,211,238,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.5) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
      {/* Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-brand-cyan/5 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-cyan/10 border border-brand-cyan/20 mb-4">
            <Factory size={24} className="text-brand-cyan" />
          </div>
          <h1 className="text-2xl font-bold text-white">PCP Fios</h1>
          <p className="text-sm text-brand-muted mt-1">Planejamento e Controle de Produção</p>
        </div>

        <div className="bg-brand-card border border-brand-border rounded-2xl p-7 shadow-2xl">
          <h2 className="text-sm font-semibold text-white mb-5">Acesse sua conta</h2>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-3 mb-5">
              <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@corradi.com.br"
                autoComplete="email" required
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-cyan/40 focus:ring-1 focus:ring-brand-cyan/20 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">Senha</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password" required
                  className="w-full bg-brand-surface border border-brand-border rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-cyan/40 focus:ring-1 focus:ring-brand-cyan/20 transition-all" />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white transition-colors">
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading || !email || !password}
              className="w-full mt-2 bg-brand-cyan hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-brand-bg font-bold text-sm rounded-xl py-3 transition-all flex items-center justify-center gap-2">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-brand-bg/30 border-t-brand-bg rounded-full animate-spin" />Entrando...</>
              ) : 'Entrar'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-brand-muted/50 mt-6">Corradi Matriz & Filial © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
