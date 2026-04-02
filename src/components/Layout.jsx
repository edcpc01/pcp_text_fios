import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CalendarDays, TrendingUp, Bot, LogOut,
  Menu, X, ChevronDown, Factory,
} from 'lucide-react';
import { useAuthStore, useAppStore, FACTORIES } from '../hooks/useStore';
import { signOut } from '../services/firebase';
import AgentPanel from './AgentPanel';
import PWAPrompt from './PWAPrompt';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/planning', icon: CalendarDays, label: 'Planejamento' },
  { to: '/production', icon: TrendingUp, label: 'Realizado' },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { factory, setFactory, sidebarOpen, toggleSidebar, agentOpen, toggleAgent } = useAppStore();
  const [factoryOpen, setFactoryOpen] = useState(false);

  const currentFactory = FACTORIES.find((f) => f.id === factory);

  const handleLogout = async () => {
    await signOut();
    logout();
    navigate('/');
  };

  return (
    <div className="flex h-screen h-dvh bg-brand-dark overflow-hidden noise-bg">

      {/* ─── Sidebar ───────────────────────────────────────────────────── */}
      <aside className={`
        glass border-r border-white/[0.06] flex flex-col shrink-0 z-30
        transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'w-56' : 'w-16'}
        fixed inset-y-0 left-0 md:relative
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/[0.06] shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-corradi to-amber-600 flex items-center justify-center shrink-0">
            <Factory size={16} className="text-amber-950" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-slate-100 truncate">PCP Fios</p>
              <p className="text-[10px] text-slate-500 truncate">Planejamento</p>
            </div>
          )}
        </div>

        {/* Factory selector */}
        <div className="px-3 pt-4 pb-2">
          <button
            onClick={() => setFactoryOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-white/[0.04] transition-colors group"
          >
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: currentFactory?.color }}
            />
            {sidebarOpen && (
              <>
                <span className="text-xs font-semibold text-slate-300 flex-1 text-left">{currentFactory?.name}</span>
                <ChevronDown size={12} className={`text-slate-500 transition-transform ${factoryOpen ? 'rotate-180' : ''}`} />
              </>
            )}
          </button>

          {factoryOpen && sidebarOpen && (
            <div className="mt-1 space-y-0.5">
              {FACTORIES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => { setFactory(f.id); setFactoryOpen(false); }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors
                    ${factory === f.id ? 'bg-white/[0.06] text-slate-100' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'}`}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: f.color }} />
                  {f.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `
                flex items-center gap-3 px-2 py-2.5 rounded-xl transition-all text-sm font-medium
                ${isActive
                  ? 'bg-brand-doptex/15 text-brand-doptex border border-brand-doptex/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'}
              `}
            >
              <Icon size={16} className="shrink-0" />
              {sidebarOpen && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Agent button */}
        <div className="px-3 pb-2">
          <button
            onClick={toggleAgent}
            className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-xl transition-all text-sm font-medium
              ${agentOpen
                ? 'bg-brand-agent/15 text-purple-400 border border-purple-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'}`}
          >
            <Bot size={16} className="shrink-0" />
            {sidebarOpen && <span>Agente IA</span>}
            {sidebarOpen && agentOpen && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400 pulse-dot" />
            )}
          </button>
        </div>

        {/* User + logout */}
        <div className="px-3 pb-4 border-t border-white/[0.06] pt-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-slate-300">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            {sidebarOpen && (
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-medium text-slate-300 truncate">{user?.name}</p>
                <p className="text-[10px] text-slate-600 truncate">{user?.email}</p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-600 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
              title="Sair"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* ─── Main area ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">

        {/* Header */}
        <header className="glass border-b border-white/[0.06] h-16 flex items-center px-4 gap-3 shrink-0">
          <button
            onClick={toggleSidebar}
            className="p-2 text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] rounded-xl transition-all"
          >
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>

          <div className="flex items-center gap-2 ml-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentFactory?.color }} />
            <span className="text-sm font-semibold text-slate-300">{currentFactory?.name}</span>
          </div>

          <div className="flex-1" />

          <button
            onClick={toggleAgent}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border
              ${agentOpen
                ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                : 'bg-white/[0.04] text-slate-400 hover:text-slate-200 border-white/[0.06]'}`}
          >
            <Bot size={14} />
            <span className="hidden sm:inline">Agente</span>
            {agentOpen && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 pulse-dot" />}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden relative">
          {children}
        </main>
      </div>

      {/* ─── Agent Panel ───────────────────────────────────────────────── */}
      {agentOpen && <AgentPanel />}

      {/* ─── PWA Prompt ────────────────────────────────────────────────── */}
      <PWAPrompt />
    </div>
  );
}
