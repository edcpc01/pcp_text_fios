import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, TrendingUp, Bot, LogOut, Settings, ChevronDown, Factory, FlaskConical } from 'lucide-react';
import { useAuthStore, useAppStore, FACTORIES } from '../hooks/useStore';
import { signOut } from '../services/firebase';
import AgentPanel from './AgentPanel';
import PWAPrompt from './PWAPrompt';
import FirebaseStatus from './FirebaseStatus';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { factory, setFactory, agentOpen, toggleAgent } = useAppStore();
  const [unitOpen, setUnitOpen] = useState(false);

  const currentFactory = FACTORIES.find((f) => f.id === factory);
  const isAdmin = user?.role === 'admin';

  const handleLogout = async () => { await signOut(); logout(); navigate('/'); };

  const NAV = [
    { to: '/',           icon: LayoutDashboard, label: 'Dashboard'    },
    { to: '/planning',   icon: CalendarDays,    label: 'Planejamento' },
    { to: '/production', icon: TrendingUp,      label: 'Realizado'    },
    { to: '/materiais',  icon: FlaskConical,    label: 'Materiais'    },
    ...(isAdmin ? [{ to: '/admin', icon: Settings, label: 'Cadastros' }] : []),
  ];

  return (
    <div className="flex flex-col min-h-screen bg-brand-bg">

      {/* ── Navbar ── */}
      <header className="bg-brand-surface border-b border-brand-border sticky top-0 z-40">
        <div className="flex items-center gap-0 px-4 h-14">

          {/* Logo */}
          <div className="flex items-center gap-3 pr-5 border-r border-brand-border mr-3">
            <div className="w-9 h-9 rounded-xl bg-brand-cyan/10 border border-brand-cyan/25 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(34,211,238,0.1)]">
              <Factory size={18} className="text-brand-cyan" />
            </div>
            <div className="hidden sm:block">
              <p className="text-[13px] font-black text-white leading-tight tracking-tight uppercase">PCP Fios</p>
              <p className="text-[10px] text-brand-cyan/70 font-semibold uppercase tracking-widest">Master</p>
            </div>
          </div>

          <nav className="flex items-center gap-1 flex-1 overflow-x-auto no-scrollbar">
            {NAV.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-bold transition-all whitespace-nowrap
                  ${isActive
                    ? 'bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 shadow-[0_0_10px_rgba(34,211,238,0.05)]'
                    : 'text-brand-muted hover:text-white hover:bg-white/5 border border-transparent'}`
                }>
                <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                <span className="hidden lg:inline">{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Unit selector */}
            <div className="relative">
              <button onClick={() => setUnitOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-brand-border hover:border-brand-cyan/30 text-sm text-white transition-all">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: currentFactory?.color }} />
                <span className="hidden md:inline text-sm">{currentFactory?.name}</span>
                <ChevronDown size={11} className={`text-brand-muted transition-transform ${unitOpen ? 'rotate-180' : ''}`} />
              </button>
              {unitOpen && (
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
              )}
            </div>

            {/* Agent */}
            <button onClick={toggleAgent}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
                ${agentOpen
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                  : 'bg-white/5 text-brand-muted border-brand-border hover:text-white'}`}>
              <Bot size={14} />
              <span className="hidden sm:inline">Agente</span>
              {agentOpen && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 pulse-dot" />}
            </button>

            {/* User initial + logout */}
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
        <div className="flex-1 overflow-auto">
          {children}
        </div>
        {agentOpen && <AgentPanel />}
      </main>

      <PWAPrompt />
      <FirebaseStatus />
    </div>
  );
}
