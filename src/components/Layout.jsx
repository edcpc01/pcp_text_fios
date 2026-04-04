import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, TrendingUp, FlaskConical,
  Bot, LogOut, Settings, ChevronDown,
} from 'lucide-react';
import { useAuthStore, useAppStore, FACTORIES } from '../hooks/useStore';
import { signOut } from '../services/firebase';
import AgentPanel from './AgentPanel';
import PWAPrompt from './PWAPrompt';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { factory, setFactory, agentOpen, toggleAgent } = useAppStore();
  const [unitOpen, setUnitOpen] = useState(false);

  const currentFactory = FACTORIES.find((f) => f.id === factory) || FACTORIES[0];
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
          <div className="flex items-center gap-2.5 pr-5 border-r border-brand-border mr-3 shrink-0">
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
              <svg viewBox="0 0 64 64" width="32" height="32">
                <rect width="64" height="64" rx="14" fill="#0d1b2e"/>
                <g transform="translate(32,39)" fill="none" stroke="#22d3ee" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="-20" y="0" width="40" height="20" rx="2" fill="#0d1b2e" stroke="#22d3ee" strokeWidth="2.8"/>
                  <rect x="-17" y="-10" width="7" height="11" rx="1.5" fill="#0d1b2e" stroke="#22d3ee" strokeWidth="2.5"/>
                  <rect x="-4"  y="-15" width="7" height="16" rx="1.5" fill="#0d1b2e" stroke="#22d3ee" strokeWidth="2.5"/>
                  <rect x="9"   y="-8"  width="7" height="9"  rx="1.5" fill="#0d1b2e" stroke="#22d3ee" strokeWidth="2.5"/>
                  <rect x="-15" y="5"   width="5" height="5" rx="1" fill="#22d3ee" stroke="none"/>
                  <rect x="-4"  y="5"   width="5" height="5" rx="1" fill="#22d3ee" stroke="none"/>
                  <rect x="7"   y="5"   width="5" height="5" rx="1" fill="#22d3ee" stroke="none"/>
                </g>
                <text x="53" y="24" fontFamily="Georgia,'Times New Roman',serif" fontSize="26" fontWeight="700" fontStyle="italic" fill="white" textAnchor="middle">D</text>
              </svg>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-white leading-none">PCP Fios</p>
              <p className="text-[10px] text-brand-muted">Planejamento</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto">
            {NAV.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap border
                  ${isActive
                    ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/20'
                    : 'text-brand-muted hover:text-white hover:bg-white/5 border-transparent'}`
                }>
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-2 shrink-0">

            {/* Unit selector */}
            <div className="relative">
              <button
                onClick={() => setUnitOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-brand-border hover:border-brand-cyan/30 text-sm text-white transition-all"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: currentFactory?.color }} />
                <span className="hidden md:inline text-sm">{currentFactory?.name}</span>
                <ChevronDown size={11} className={`text-brand-muted transition-transform ${unitOpen ? 'rotate-180' : ''}`} />
              </button>

              {unitOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-brand-card border border-brand-border rounded-xl shadow-2xl z-50 py-1.5 animate-fade-in">
                  {FACTORIES.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => { setFactory(f.id); setUnitOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors
                        ${factory === f.id ? 'text-white bg-white/5' : 'text-brand-muted hover:text-white hover:bg-white/5'}`}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                      {f.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Agent */}
            <button
              onClick={toggleAgent}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
                ${agentOpen
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                  : 'bg-white/5 text-brand-muted border-brand-border hover:text-white'}`}
            >
              <Bot size={14} />
              <span className="hidden sm:inline">Agente</span>
              {agentOpen && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 pulse-dot" />}
            </button>

            {/* User + logout */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-brand-border">
              <div
                className="w-7 h-7 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center shrink-0"
                title={`${user?.name} (${user?.role})`}
              >
                <span className="text-[11px] font-bold text-brand-cyan">
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                title="Sair"
                className="p-1.5 text-brand-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
              >
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
    </div>
  );
}
