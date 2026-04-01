import { useState } from 'react';
import { useAuthStore } from '../hooks/useStore';
import { signIn } from '../services/firebase';
import { Eye, EyeOff, Factory, AlertCircle } from 'lucide-react';

export default function Login() {
  const { setUser, setLoading, setError, error, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);

    try {
      const result = await signIn(email, password);
      setUser({
        uid: result.user.uid,
        email: result.user.email,
        name: result.user.displayName || result.user.email.split('@')[0],
      });
    } catch (err) {
      const messages = {
        'auth/invalid-credential': 'E-mail ou senha incorretos.',
        'auth/user-not-found': 'Usuário não encontrado.',
        'auth/wrong-password': 'Senha incorreta.',
        'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
        'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
      };
      setError(messages[err.code] || 'Erro ao entrar. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen min-h-dvh bg-brand-dark flex items-center justify-center px-4 relative overflow-hidden">

      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-brand-doptex/5 blur-[120px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[400px] h-[400px] rounded-full bg-brand-corradi/5 blur-[100px]" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="w-full max-w-sm relative z-10 animate-fade-in">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-corradi to-amber-600 shadow-lg shadow-amber-500/20 mb-5">
            <Factory size={28} className="text-amber-950" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Corradi</h1>
          <p className="text-sm text-slate-500 mt-1">Planejamento de Produção</p>
        </div>

        {/* Card */}
        <div className="bg-brand-navy border border-white/[0.06] rounded-2xl p-8 shadow-2xl shadow-black/40">
          <h2 className="text-base font-semibold text-slate-200 mb-6">Entrar na plataforma</h2>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-3 mb-5">
              <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* E-mail */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@corradi.com.br"
                autoComplete="email"
                required
                className="w-full bg-brand-slate/60 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-brand-doptex/50 focus:ring-1 focus:ring-brand-doptex/30 transition-all"
              />
            </div>

            {/* Senha */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full bg-brand-slate/60 border border-white/[0.08] rounded-xl px-4 py-3 pr-11 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-brand-doptex/50 focus:ring-1 focus:ring-brand-doptex/30 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full mt-2 bg-gradient-to-r from-brand-corradi to-amber-500 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-amber-950 font-semibold text-sm rounded-xl py-3 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-amber-900/40 border-t-amber-900 rounded-full animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-6">
          Doptex & Corradi © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
