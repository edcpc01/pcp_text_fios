import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, TrendingUp, FlaskConical,
  Bot, LogOut, Settings, ChevronDown, X, Menu, LineChart, RefreshCw,
} from 'lucide-react';
import { useAuthStore, useAppStore, FACTORIES } from '../hooks/useStore';
import { signOut } from '../services/firebase';
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

  const handleLogout = async () => { await signOut(); logout(); navigate('/'); };

  const NAV = [
    { to: '/',           icon: LayoutDashboard, label: 'Dashboard'    },
    { to: '/production', icon: TrendingUp,      label: 'Realizado'    },
    { to: '/materiais',  icon: FlaskConical,    label: 'Materiais'    },
    { to: '/forecast',   icon: LineChart,       label: 'Forecast'     },
    { to: '/planning',   icon: CalendarDays,    label: 'Planejamento' },
    ...(isAdmin ? [{ to: '/admin', icon: Settings, label: 'Cadastros' }] : []),
  ];

  // SVG logo inline
  const LogoSVG = () => (
    <svg viewBox="0 0 64 64" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="12" fill="#06b6d4"/>
      <text x="32" y="28" fontFamily="Georgia,'Times New Roman',serif" fontSize="30" fontWeight="700" fontStyle="italic" fill="white" textAnchor="middle" dominantBaseline="middle">D</text>
      <g transform="translate(32,54)" fill="none" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6">
        <rect x="-15" y="-10" width="30" height="11" rx="1" fill="#06b6d4" stroke="white" strokeWidth="1.4"/>
        <rect x="-12" y="-18" width="5" height="9"  rx="0.8" fill="#06b6d4" stroke="white" strokeWidth="1.3"/>
        <rect x="-3"  y="-22" width="5" height="13" rx="0.8" fill="#06b6d4" stroke="white" strokeWidth="1.3"/>
        <rect x="7"   y="-16" width="5" height="7"  rx="0.8" fill="#06b6d4" stroke="white" strokeWidth="1.3"/>
        <rect x="-11" y="-6"  width="4" height="4" rx="0.5" fill="white" stroke="none"/>
        <rect x="-3"  y="-6"  width="4" height="4" rx="0.5" fill="white" stroke="none"/>
        <rect x="5"   y="-6"  width="4" height="4" rx="0.5" fill="white" stroke="none"/>
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
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap border
                  ${isActive
                    ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20'
                    : 'text-brand-muted hover:text-white hover:bg-white/5 border-transparent'}`
                }>
                <Icon size={14} />
                <span>{label}</span>
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
              onClick={() => window.location.reload(true)}
              title="Buscar atualização (Ctrl+Shift+R)"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all bg-white/5 text-brand-muted border-brand-border hover:text-white"
            >
              <RefreshCw size={14} />
              <span>Atualizar</span>
            </button>

            {/* Agent — desktop */}
            <button onClick={toggleAgent}
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
                ${agentOpen
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                  : 'bg-white/5 text-brand-muted border-brand-border hover:text-white'}`}>
              <Bot size={14} />
              <span>Agente</span>
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
        {NAV.slice(0, 5).map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors
              ${isActive ? 'text-brand-cyan' : 'text-brand-muted'}`
            }
            onClick={() => { if (agentOpen) closeAgent(); }}>
            {({ isActive }) => (
              <>
                <div className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all
                  ${isActive ? 'bg-brand-cyan/10' : ''}`}>
                  <Icon size={18} />
                </div>
                <span className="leading-none">{label.split(' ')[0]}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* Agente — mobile */}
        <button onClick={toggleAgent}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors
            ${agentOpen ? 'text-purple-400' : 'text-brand-muted'}`}>
          <div className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all
            ${agentOpen ? 'bg-purple-500/10' : ''}`}>
            <Bot size={18} />
            {agentOpen && <span className="absolute top-2 right-0 w-1.5 h-1.5 rounded-full bg-purple-400" />}
          </div>
          <span className="leading-none">Agente</span>
        </button>
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
