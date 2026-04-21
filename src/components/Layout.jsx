import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, TrendingUp,
  Bot, LogOut, Settings, ChevronDown, X, Menu, LineChart, RefreshCw,
} from 'lucide-react';

// Ícone de bobina de fio — substitui FlaskConical na nav de Materiais
function SpoolIcon({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         xmlns="http://www.w3.org/2000/svg" className={className}
         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="18.5" rx="8" ry="2.5"/>
      <ellipse cx="12" cy="5.5"  rx="8" ry="2.5"/>
      <line x1="4"  y1="5.5"  x2="4"  y2="18.5"/>
      <line x1="20" y1="5.5"  x2="20" y2="18.5"/>
      <line x1="4"  y1="7"  x2="20" y2="13"/>
      <line x1="4"  y1="12" x2="20" y2="18"/>
      <line x1="4"  y1="13" x2="20" y2="7"/>
      <line x1="4"  y1="18" x2="20" y2="12"/>
    </svg>
  );
}
import { useAuthStore, useAppStore, FACTORIES } from '../hooks/useStore';
import { signOut, subscribeForecast, subscribeFinishedGoodsStock } from '../services/firebase';
import AgentPanel from './AgentPanel';
import PWAPrompt from './PWAPrompt';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { factory, setFactory, agentOpen, toggleAgent, closeAgent } = useAppStore();
  const [unitOpen, setUnitOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const currentFactory = FACTORIES.find((f) => f.id === factory) || FACTORIES[0];
  const isAdmin = user?.role === 'admin';

  // ── Alertas de ruptura de forecast ───────────────────────────────────────
  const [criticalCount, setCriticalCount] = useState(0);
  const prevCriticalRef = useRef(0);

  useEffect(() => {
    const currentYM = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();

    let forecastList = [];
    let paStockMap   = {};

    function recalc() {
      const paByCode = {};
      Object.values(paStockMap).forEach((v) => {
        if (v.codigoMicrodata) paByCode[v.codigoMicrodata] = v.estoqueKg || 0;
      });

      let critical = 0;
      forecastList.forEach((item) => {
        const forecastKg = item.months?.[currentYM] || 0;
        if (forecastKg <= 0) return;
        const estoqueKg = paByCode[item.code] || 0;
        const delta     = estoqueKg - forecastKg;
        // crítico = déficit > 30% do forecast
        if (delta < -(forecastKg * 0.3)) critical++;
      });

      setCriticalCount((prev) => {
        if (critical > 0 && critical !== prevCriticalRef.current) {
          // Dispara notificação via SW (obrigatório em PWA standalone)
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const body = `${critical} produto${critical > 1 ? 's' : ''} com estoque crítico para ${currentYM}`;
            const opts = { body, icon: '/icons/icon-192.png', tag: 'ruptura-forecast' };
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready
                .then((reg) => reg.showNotification('Alerta de Ruptura — PCP Fios', opts))
                .catch(() => {});
            }
          }
        }
        prevCriticalRef.current = critical;
        return critical;
      });
    }

    const unsubF = subscribeForecast((list) => { forecastList = list; recalc(); });
    const unsubP = subscribeFinishedGoodsStock((map) => { paStockMap = map; recalc(); });

    // Solicita permissão de notificação apenas se SW estiver pronto (seguro em PWA standalone)
    if (typeof Notification !== 'undefined' && Notification.permission === 'default' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(() => Notification.requestPermission())
        .catch(() => {});
    }

    return () => { unsubF(); unsubP(); };
  }, []);

  const handleLogout = async () => { await signOut(); logout(); navigate('/'); };

  const handleHardReload = async () => {
    // Nuclear reload: desregistra SW + limpa caches + recarrega ignorando cache.
    // Resolve casos em que o SW/HTML antigos ficaram presos referenciando bundles deletados.
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (_) { /* ignore */ }
    window.location.replace(window.location.origin + '/?nocache=' + Date.now());
  };

  const NAV = [
    { to: '/',           icon: LayoutDashboard, label: 'Dashboard'    },
    { to: '/production', icon: TrendingUp,      label: 'Realizado'    },
    { to: '/materiais',  icon: SpoolIcon,       label: 'Materiais'    },
    { to: '/forecast',   icon: LineChart,       label: 'Forecast'     },
    { to: '/planning',   icon: CalendarDays,    label: 'Planejamento' },
    ...(isAdmin ? [{ to: '/admin', icon: Settings, label: 'Cadastros' }] : []),
  ];

  // SVG logo inline — azul Doptex
  const LogoSVG = () => (
    <svg viewBox="0 0 64 64" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="12" fill="#1553b5"/>
      <text x="31" y="26" fontFamily="Georgia,'Times New Roman',serif" fontSize="26" fontWeight="700" fontStyle="italic" fill="white" textAnchor="middle" dominantBaseline="middle">D</text>
      <g transform="translate(32,52)" fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round">
        <rect x="-16" y="-10" width="32" height="11" rx="1.2" fill="#1553b5" stroke="white" strokeWidth="1.5"/>
        <rect x="-13" y="-20" width="6"  height="11" rx="1"   fill="#1553b5" stroke="white" strokeWidth="1.3"/>
        <rect x="-3"  y="-25" width="6"  height="16" rx="1"   fill="#1553b5" stroke="white" strokeWidth="1.3"/>
        <rect x="7"   y="-17" width="6"  height="8"  rx="1"   fill="#1553b5" stroke="white" strokeWidth="1.3"/>
        <rect x="-12" y="-6"  width="4"  height="4"  rx="0.6" fill="white"   stroke="none"/>
        <rect x="-4"  y="-6"  width="4"  height="4"  rx="0.6" fill="white"   stroke="none"/>
        <rect x="4"   y="-6"  width="4"  height="4"  rx="0.6" fill="white"   stroke="none"/>
      </g>
    </svg>
  );

  return (
    <div className="flex flex-col min-h-screen bg-brand-bg">

      {/* ── Desktop/Tablet Header ── */}
      <header className="bg-brand-surface border-b border-brand-border sticky top-0 z-40">
        <div className="flex items-center gap-0 px-4 h-14">

          {/* Logo */}
          <div className="flex items-center gap-2.5 pr-4 border-r border-brand-border mr-3 shrink-0">
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0"><LogoSVG /></div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-white leading-none">PCP Fios</p>
              <p className="text-[10px] text-brand-muted">Planejamento</p>
            </div>
          </div>

          {/* Nav — oculto em mobile (usa bottom bar) */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 overflow-x-auto">
            {NAV.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) =>
                  `relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap border
                  ${isActive
                    ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20'
                    : 'text-brand-muted hover:text-white hover:bg-white/5 border-transparent'}`
                }>
                <Icon size={14} />
                <span>{label}</span>
                {to === '/' && criticalCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {criticalCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Spacer em mobile */}
          <div className="flex-1 md:hidden" />

          {/* Right */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Unit selector */}
            <div className="relative">
              <button
                onClick={() => setUnitOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-brand-border hover:border-brand-cyan/30 text-sm text-white transition-all"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: currentFactory?.color }} />
                <span className="hidden sm:inline text-sm">{currentFactory?.name}</span>
                <ChevronDown size={11} className={`text-brand-muted transition-transform ${unitOpen ? 'rotate-180' : ''}`} />
              </button>
              {unitOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUnitOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-brand-card border border-brand-border rounded-xl shadow-2xl z-50 py-1.5 animate-fade-in">
                    {FACTORIES.map((f) => (
                      <button key={f.id} onClick={() => { setFactory(f.id); setUnitOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors
                          ${factory === f.id ? 'text-white bg-white/5' : 'text-brand-muted hover:text-white hover:bg-white/5'}`}>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                        {f.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Hard reload */}
            <button
              onClick={handleHardReload}
              title="Buscar atualização (Ctrl+Shift+R)"
              className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg text-sm font-medium border transition-all bg-white/5 text-brand-muted border-brand-border hover:text-white"
            >
              <RefreshCw size={14} />
              <span className="hidden md:inline">Atualizar</span>
            </button>

            {/* Agent */}
            <button onClick={toggleAgent}
              className={`flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
                ${agentOpen
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                  : 'bg-white/5 text-brand-muted border-brand-border hover:text-white'}`}>
              <Bot size={14} />
              <span className="hidden md:inline">Agente</span>
              {agentOpen && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 pulse-dot" />}
            </button>

            {/* User + logout */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-brand-border">
              <div className="w-7 h-7 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center shrink-0"
                title={`${user?.name} (${user?.role})`}>
                <span className="text-[11px] font-bold text-brand-cyan">
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <button onClick={handleLogout} title="Sair"
                className="p-1.5 text-brand-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                <LogOut size={13} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto pb-16 md:pb-0">
          {children}
        </div>
        {agentOpen && <AgentPanel />}
      </main>

      {/* ── Mobile Bottom Tab Bar ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-brand-surface border-t border-brand-border
        flex items-stretch safe-area-bottom">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors
              ${isActive ? 'text-brand-cyan' : 'text-brand-muted'}`
            }
            onClick={() => { if (agentOpen) closeAgent(); }}>
            {({ isActive }) => (
              <>
                <div className={`relative w-8 h-8 flex items-center justify-center rounded-xl transition-all
                  ${isActive ? 'bg-brand-cyan/10' : ''}`}>
                  <Icon size={18} />
                  {to === '/' && criticalCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center leading-none">
                      {criticalCount}
                    </span>
                  )}
                </div>
                <span className="leading-none">{label.split(' ')[0]}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Agent Panel — mobile full screen overlay ── */}
      {agentOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col bg-brand-bg">
          <div className="flex items-center justify-between px-4 h-14 border-b border-brand-border bg-brand-surface shrink-0">
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-purple-400" />
              <span className="text-sm font-semibold text-white">Agente PCP</span>
            </div>
            <button onClick={closeAgent} className="p-1.5 text-brand-muted hover:text-white rounded-lg">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <AgentPanel mobileFullscreen />
          </div>
        </div>
      )}

      <PWAPrompt />
    </div>
  );
}
