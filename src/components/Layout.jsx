import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, TrendingUp, Bot, LogOut, Settings, ChevronDown, Factory } from 'lucide-react';
import { useAuthStore, useAppStore, FACTORIES } from '../hooks/useStore';
import { signOut } from '../services/firebase';
import AgentPanel from './AgentPanel';
import PWAPrompt from './PWAPrompt';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { factory, setFactory, agentOpen, toggleAgent, closeAgent } = useAppStore();
  const [unitOpen, setUnitOpen] = useState(false);

  const currentFactory = FACTORIES.find((f) => f.id === factory);

  const handleLogout = async () => { await signOut(); logout(); navigate('/'); };

  const NAV = [
    { to: '/',           icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/planning',   icon: CalendarDays,    label: 'Planejamento' },
    { to: '/production', icon: TrendingUp,      label: 'Realizado' },
    ...(user?.role === 'admin' ? [{ to: '/admin', icon: Settings, label: 'Cadastros' }] : []),
  ];

  return (
    <div className="flex flex-col min-h-screen bg-brand-bg">

      {/* ── Top navbar (façonagem style) ── */}
      <header className="bg-brand-surface border-b border-brand-border sticky top-0 z-40">
        <div className="flex items-center gap-0 px-4 h-14">

          {/* Logo */}
          <div className="flex items-center gap-2.5 pr-6 border-r border-brand-border mr-2">
            <div className="w-8 h-8 rounded-lg bg-brand-cyan/10 border border-brand-cyan/30 flex items-center justify-center">
              <Factory size={15} className="text-brand-cyan" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-none">PCP Fios</p>
              <p className="text-[10px] text-brand-muted">Planejamento</p>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-1 flex-1">
            {NAV.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) => `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                  ${isActive
                    ? 'bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20'
                    : 'text-brand-muted hover:text-white hover:bg-white/5'}`}>
                <Icon size={14} />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">

            {/* Unit selector */}
            <div className="relative">
              <button onClick={() => setUnitOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-brand-border hover:border-brand-cyan/30 text-sm text-white transition-all">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentFactory?.color }} />
                <span className="hidden sm:inline">{currentFactory?.name}</span>
                <ChevronDown size={12} className={`text-brand-muted transition-transform ${unitOpen ? 'rotate-180' : ''}`} />
              </button>
              {unitOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-brand-card border border-brand-border rounded-xl shadow-2xl z-50 py-1 animate-fade-in">
                  {FACTORIES.map((f) => (
                    <button key={f.id} onClick={() => { setFactory(f.id); setUnitOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors
                        ${factory === f.id ? 'text-white bg-white/5' : 'text-brand-muted hover:text-white hover:bg-white/5'}`}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
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
                  ? 'bg-brand-agent/10 text-purple-400 border-brand-agent/30'
                  : 'bg-white/5 text-brand-muted border-brand-border hover:text-white'}`}>
              <Bot size={14} />
              <span className="hidden sm:inline">Agente</span>
              {agentOpen && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 pulse-dot" />}
            </button>

            {/* User */}
            <div className="flex items-center gap-2 pl-2 border-l border-brand-border">
              <div className="w-7 h-7 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center">
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

      {/* ── Page content ── */}
      <main className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 overflow-auto">
          {children}
        </div>
        {agentOpen && <AgentPanel />}
      </main>

      <PWAPrompt />
    </div>
  );
}
