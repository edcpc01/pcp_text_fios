import { useState, useEffect } from 'react';
import { useAuthStore } from '../hooks/useStore';
import { signIn, signInWithGoogle, getGoogleRedirectResult, registerWithEmail, sendPasswordReset, getUserRole } from '../services/firebase';
import { Eye, EyeOff, Factory, AlertCircle, Mail, ArrowLeft } from 'lucide-react';

// ─── Google Icon SVG ──────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}

// ─── Reusable field input ─────────────────────────────────────────────────────
const inputCls = 'w-full bg-brand-surface border border-brand-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-brand-muted/50 focus:outline-none focus:border-brand-cyan/40 focus:ring-1 focus:ring-brand-cyan/20 transition-all';

// ─── Divider ─────────────────────────────────────────────────────────────────
function Divider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-brand-border" />
      <span className="text-[11px] text-brand-muted uppercase tracking-wider font-medium">ou</span>
      <div className="flex-1 h-px bg-brand-border" />
    </div>
  );
}

// ─── Error Banner ─────────────────────────────────────────────────────────────
function ErrorBanner({ msg }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-3 mb-4">
      <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
      <p className="text-sm text-red-300">{msg}</p>
    </div>
  );
}

// ─── Success Banner ───────────────────────────────────────────────────────────
function SuccessBanner({ msg }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3.5 py-3 mb-4">
      <Mail size={14} className="text-emerald-400 mt-0.5 shrink-0" />
      <p className="text-sm text-emerald-300">{msg}</p>
    </div>
  );
}

// ─── Auth error map ───────────────────────────────────────────────────────────
function mapAuthError(code) {
  const msgs = {
    'auth/invalid-credential':        'E-mail ou senha incorretos.',
    'auth/user-not-found':            'Usuário não encontrado.',
    'auth/wrong-password':            'Senha incorreta.',
    'auth/email-already-in-use':      'Este e-mail já está em uso.',
    'auth/weak-password':             'Senha muito fraca. Mínimo 6 caracteres.',
    'auth/invalid-email':             'E-mail inválido.',
    'auth/too-many-requests':         'Muitas tentativas. Aguarde e tente novamente.',
    'auth/network-request-failed':    'Sem conexão. Verifique sua internet.',
    'auth/popup-closed-by-user':      'Login cancelado.',
    'auth/popup-blocked':             'Popup bloqueado pelo navegador.',
    'auth/cancelled-popup-request':   'Requisição de login cancelada.',
    'auth/unauthorized-domain':       'Domínio não autorizado no Firebase.',
    'auth/operation-not-allowed':     'Login com Google não habilitado no projeto.',
    'auth/internal-error':            'Erro interno. Tente novamente.',
  };
  return msgs[code] || `Erro inesperado (${code || 'desconhecido'}). Tente novamente.`;
}

// ─── View: Login ─────────────────────────────────────────────────────────────
function LoginView({ onForgotPassword, onRegister, onGoogleSuccess, onEmailSuccess }) {
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [google, setGoogle]   = useState(false);
  const [error, setError]     = useState('');

  // Captura resultado do signInWithRedirect (mobile/PWA) ao montar
  useEffect(() => {
    setGoogle(true);
    getGoogleRedirectResult()
      .then(async (result) => {
        if (!result) return; // nenhum redirect pendente
        const role = await getUserRole(result.user.uid, result.user);
        onGoogleSuccess(result.user, role);
      })
      .catch((err) => {
        if (err.code && err.code !== 'auth/no-current-user') {
          setError(mapAuthError(err.code));
        }
      })
      .finally(() => setGoogle(false));
  }, []);

  const handleEmail = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const cred = await signIn(email, password);
      const role = await getUserRole(cred.user.uid, cred.user);
      onEmailSuccess(cred.user, role);
    } catch (err) {
      setError(mapAuthError(err.code));
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setGoogle(true); setError('');
    try {
      const result = await signInWithGoogle();
      // signInWithRedirect retorna undefined (redireciona) — não trata aqui
      // signInWithPopup retorna o credential — trata imediatamente
      if (result?.user) {
        const role = await getUserRole(result.user.uid, result.user);
        onGoogleSuccess(result.user, role);
      }
      // Se redirect: página será redirecionada pelo browser, o useEffect acima captura ao voltar
    } catch (err) {
      setError(mapAuthError(err.code));
      setGoogle(false);
    }
  };

  return (
    <>
      <h2 className="text-sm font-semibold text-white mb-5">Acesse sua conta</h2>
      <ErrorBanner msg={error} />

      {/* Google */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={google || loading}
        className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-brand-border hover:border-white/20 rounded-xl py-3 text-sm font-medium text-white transition-all disabled:opacity-40"
      >
        {google
          ? <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          : <GoogleIcon />
        }
        Entrar com Google
      </button>

      <Divider />

      {/* Email + senha */}
      <form onSubmit={handleEmail} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@corradi.com.br" autoComplete="email" required className={inputCls} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-brand-muted uppercase tracking-wider">Senha</label>
            <button type="button" onClick={onForgotPassword}
              className="text-[11px] text-brand-cyan hover:text-cyan-300 transition-colors">
              Esqueceu a senha?
            </button>
          </div>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete="current-password" required
              className={`${inputCls} pr-11`} />
            <button type="button" onClick={() => setShowPw((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white transition-colors">
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading || !email || !password}
          className="w-full mt-1 bg-brand-cyan hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-brand-bg font-bold text-sm rounded-xl py-3 transition-all flex items-center justify-center gap-2">
          {loading
            ? <><span className="w-4 h-4 border-2 border-brand-bg/30 border-t-brand-bg rounded-full animate-spin"/>Entrando...</>
            : 'Entrar'}
        </button>
      </form>

      <p className="text-center text-xs text-brand-muted mt-5">
        Não tem conta?{' '}
        <button type="button" onClick={onRegister} className="text-brand-cyan hover:text-cyan-300 font-medium transition-colors">
          Criar conta
        </button>
      </p>
    </>
  );
}

// ─── View: Register ───────────────────────────────────────────────────────────
function RegisterView({ onBack, onSuccess }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [name, setName]         = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    if (password.length < 6)  { setError('Senha deve ter no mínimo 6 caracteres.'); return; }
    setLoading(true); setError('');
    try {
      const cred = await registerWithEmail(email, password, name);
      const role = await getUserRole(cred.user.uid, cred.user);
      onSuccess(cred.user, role);
    } catch (err) {
      setError(mapAuthError(err.code));
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-5">
        <button type="button" onClick={onBack} className="p-1 text-brand-muted hover:text-white transition-colors">
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-sm font-semibold text-white">Criar conta</h2>
      </div>
      <ErrorBanner msg={error} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">Nome</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome" autoComplete="name" required className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@corradi.com.br" autoComplete="email" required className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">Senha</label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres" autoComplete="new-password" required className={`${inputCls} pr-11`} />
            <button type="button" onClick={() => setShowPw((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-white transition-colors">
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">Confirmar Senha</label>
          <input type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repita a senha" autoComplete="new-password" required className={inputCls} />
        </div>
        <button type="submit" disabled={loading || !email || !password || !name}
          className="w-full mt-1 bg-brand-cyan hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-brand-bg font-bold text-sm rounded-xl py-3 transition-all flex items-center justify-center gap-2">
          {loading
            ? <><span className="w-4 h-4 border-2 border-brand-bg/30 border-t-brand-bg rounded-full animate-spin"/>Criando...</>
            : 'Criar conta'}
        </button>
      </form>

      <p className="text-center text-[11px] text-brand-muted mt-4">
        Novas contas aguardam aprovação de acesso pelo administrador.
      </p>
    </>
  );
}

// ─── View: Forgot Password ────────────────────────────────────────────────────
function ForgotPasswordView({ onBack }) {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [sent, setSent]       = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(mapAuthError(err.code));
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-5">
        <button type="button" onClick={onBack} className="p-1 text-brand-muted hover:text-white transition-colors">
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-sm font-semibold text-white">Recuperar senha</h2>
      </div>

      {sent ? (
        <>
          <SuccessBanner msg={`E-mail de recuperação enviado para ${email}. Verifique sua caixa de entrada.`} />
          <button type="button" onClick={onBack}
            className="w-full mt-2 border border-brand-border text-brand-muted hover:text-white rounded-xl py-3 text-sm transition-all">
            Voltar ao login
          </button>
        </>
      ) : (
        <>
          <ErrorBanner msg={error} />
          <p className="text-xs text-brand-muted mb-4">
            Informe o e-mail da sua conta e enviaremos um link para redefinir a senha.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@corradi.com.br" autoComplete="email" required className={inputCls} />
            </div>
            <button type="submit" disabled={loading || !email}
              className="w-full bg-brand-cyan hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-brand-bg font-bold text-sm rounded-xl py-3 transition-all flex items-center justify-center gap-2">
              {loading
                ? <><span className="w-4 h-4 border-2 border-brand-bg/30 border-t-brand-bg rounded-full animate-spin"/>Enviando...</>
                : 'Enviar link de recuperação'}
            </button>
          </form>
        </>
      )}
    </>
  );
}

// ─── Main Login Page ──────────────────────────────────────────────────────────
export default function Login() {
  const { setUser } = useAuthStore();
  const [view, setView] = useState('login'); // 'login' | 'register' | 'forgot'

  const handleAuthSuccess = (firebaseUser, role) => {
    setUser({
      uid:   firebaseUser.uid,
      email: firebaseUser.email,
      name:  firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
      role:  role || 'supervisor',
    });
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
          {view === 'login' && (
            <LoginView
              onForgotPassword={() => setView('forgot')}
              onRegister={() => setView('register')}
              onEmailSuccess={handleAuthSuccess}
              onGoogleSuccess={handleAuthSuccess}
            />
          )}
          {view === 'register' && (
            <RegisterView onBack={() => setView('login')} onSuccess={handleAuthSuccess} />
          )}
          {view === 'forgot' && (
            <ForgotPasswordView onBack={() => setView('login')} />
          )}
        </div>

        <p className="text-center text-xs text-brand-muted/50 mt-6">Corradi Matriz & Filial © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
