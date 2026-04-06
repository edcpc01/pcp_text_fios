import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Send, Bot, User, AlertCircle } from 'lucide-react';
import {
  useAppStore, usePlanningStore, useProductionStore, useAdminStore,
} from '../hooks/useStore';

// ─── Gemini API ───────────────────────────────────────────────────────────────
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = API_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`
  : null;

// ─── Quick actions ────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Resumo do mês',    query: 'Faça um resumo geral da produção e planejamento do mês atual.' },
  { label: 'Aderência',        query: 'Como está a aderência ao planejamento? O que pode ser melhorado?' },
  { label: 'Produção de hoje', query: 'Qual foi a produção de hoje e como está em relação ao planejado?' },
  { label: 'Estoque MP',       query: 'Como está o estoque de matéria-prima em relação à necessidade do mês?' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function now() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtKg(v) {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${Math.round(v)} kg`;
}

// ─── System prompt com contexto real ─────────────────────────────────────────
function buildSystemPrompt(ctx) {
  const factoryLabel =
    ctx.factory === 'all' ? 'Todas as Unidades (Corradi Matriz + Corradi Filial)' :
    ctx.factory === 'matriz' ? 'Corradi Matriz' : 'Corradi Filial';

  return `Você é um assistente especializado em planejamento e controle de produção (PCP) de fios texturizados das empresas Corradi e Doptex.

Responda sempre em português brasileiro, de forma objetiva e prática. Use dados reais do contexto abaixo.

=== CONTEXTO ATUAL ===
Fábrica/Unidade: ${factoryLabel}
Mês de referência: ${ctx.yearMonth}
Data atual: ${new Date().toLocaleDateString('pt-BR')}

=== PRODUÇÃO ===
Total Planejado no mês: ${fmtKg(ctx.totalPlanned)}
Planejado até D-1 (ontem): ${fmtKg(ctx.plannedD1)}
Total Realizado (sincronizado): ${fmtKg(ctx.totalActual)}
Aderência (realizado ÷ planejado D-1): ${ctx.adherence}%
Número de máquinas cadastradas: ${ctx.machineCount}

=== PLANEJAMENTO (top produtos) ===
${ctx.productMix.map(([name, kg]) => `• ${name}: ${fmtKg(kg)}`).join('\n') || 'Sem dados de planejamento'}

=== ESTOQUE MP (Microdata) ===
Total em estoque: ${fmtKg(ctx.totalMpKg)}
${ctx.topMps.map((m) => `• [${m.code}] ${m.desc}: ${fmtKg(m.kg)}`).join('\n') || 'Sem dados de estoque'}

=== ESTOQUE PA (Microdata) ===
Total em estoque: ${fmtKg(ctx.totalPaKg)}
${ctx.topPas.map((p) => `• [${p.id}] ${p.name}: ${fmtKg(p.kg)}`).join('\n') || 'Sem dados de estoque'}

Quando não souber algo com certeza, diga que precisa de mais dados. Nunca invente números que não estejam no contexto.`;
}

// ─── Message component ────────────────────────────────────────────────────────
function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5
        ${isUser ? 'bg-brand-cyan/20' : 'bg-purple-500/20'}`}>
        {isUser
          ? <User size={13} className="text-brand-cyan" />
          : <Bot size={13} className="text-purple-400" />}
      </div>
      <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
        ${isUser
          ? 'bg-brand-cyan/20 text-white rounded-tr-sm'
          : 'bg-brand-surface/60 text-white rounded-tl-sm border border-brand-border'}`}>
        {msg.content.split('\n').map((line, i) => {
          const html = line
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/•/g, '•');
          return <p key={i} className={i > 0 ? 'mt-1' : ''} dangerouslySetInnerHTML={{ __html: html }} />;
        })}
        <p className="text-[10px] text-white/50 mt-1.5">{msg.time}</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AgentPanel() {
  const { closeAgent, factory, getYearMonth } = useAppStore();
  const { entriesMap }    = usePlanningStore();
  const { records }       = useProductionStore();
  const { machines: adminMachines } = useAdminStore();

  const yearMonth = getYearMonth();

  // Compute context for system prompt
  const ctx = useMemo(() => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const allEntries = Object.values(entriesMap).filter(
      (e) => (e.cellType === 'producao' || !e.cellType) &&
             (factory === 'all' || e.factory === factory),
    );

    const totalPlanned = Math.round(allEntries.reduce((s, e) => s + (e.planned || 0), 0));
    const plannedD1    = Math.round(
      allEntries
        .filter((e) => e.date && e.date.startsWith(yearMonth) && e.date <= yesterday)
        .reduce((s, e) => s + (e.planned || 0), 0),
    );
    const totalActual  = Math.round(records.reduce((s, r) => s + (r.actual || 0), 0));
    const adherence    = plannedD1 > 0 ? Math.round((totalActual / plannedD1) * 100) : 0;

    const mixMap = {};
    allEntries.forEach((e) => {
      if (!mixMap[e.productName]) mixMap[e.productName] = 0;
      mixMap[e.productName] += e.planned || 0;
    });
    const productMix = Object.entries(mixMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const machines = factory === 'all'
      ? [...(adminMachines.matriz || []), ...(adminMachines.filial || [])]
      : adminMachines[factory] || [];

    return {
      factory, yearMonth, totalPlanned, plannedD1, totalActual, adherence,
      productMix, machineCount: machines.length,
      // stock will be injected if available (subscribed from Dashboard)
      totalMpKg: 0, totalPaKg: 0, topMps: [], topPas: [],
    };
  }, [entriesMap, records, adminMachines, factory, yearMonth]);

  const [messages, setMessages] = useState([{
    id: 1, role: 'assistant', time: now(),
    content: `Olá! Sou o assistente de produção da Corradi/Doptex.\n\nTenho acesso ao planejamento, produção realizada e estoque do mês atual. Como posso ajudar?`,
  }]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const bottomRef = useRef(null);
  const historyRef = useRef([]); // mantém histórico no formato Gemini

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (query) => {
    const q = (query || input).trim();
    if (!q || loading) return;
    setInput('');
    setError(null);

    const userMsg = { id: Date.now(), role: 'user', content: q, time: now() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    // Adiciona ao histórico Gemini
    historyRef.current.push({ role: 'user', parts: [{ text: q }] });

    try {
      if (!GEMINI_URL) throw new Error('VITE_GEMINI_API_KEY não configurada.');

      const body = {
        contents: [
          // Contexto injetado como primeiro turno (compatível com todas as versões da API)
          { role: 'user',  parts: [{ text: buildSystemPrompt(ctx) }] },
          { role: 'model', parts: [{ text: 'Entendido. Tenho o contexto completo e estou pronto para ajudar.' }] },
          ...historyRef.current,
        ],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
      };

      const res  = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Erro ${res.status}`);
      }

      const data    = await res.json();
      const text    = data?.candidates?.[0]?.content?.parts?.[0]?.text || '(sem resposta)';

      // Salva resposta no histórico
      historyRef.current.push({ role: 'model', parts: [{ text }] });

      setMessages((prev) => [...prev, {
        id: Date.now() + 1, role: 'assistant', content: text, time: now(),
      }]);
    } catch (e) {
      setError(e.message);
      // Remove a última mensagem do histórico se falhou
      historyRef.current.pop();
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="w-80 border-l border-brand-border glass flex flex-col shrink-0 z-20
      fixed inset-y-0 right-0 md:relative animate-slide-right">

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-brand-border shrink-0">
        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
          <Bot size={15} className="text-purple-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Agente PCP</p>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${API_KEY ? 'bg-brand-success' : 'bg-amber-400'}`} />
            <span className="text-[10px] text-brand-muted">
              {API_KEY ? 'Gemini Flash' : 'API key não configurada'}
            </span>
          </div>
        </div>
        <button onClick={closeAgent} className="p-1.5 text-brand-muted hover:text-white hover:bg-white/5 rounded-lg transition-all">
          <X size={14} />
        </button>
      </div>

      {/* Quick actions */}
      <div className="px-3 py-2.5 border-b border-brand-border shrink-0">
        <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-2">Ações rápidas</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((a) => (
            <button key={a.label} onClick={() => send(a.query)} disabled={loading}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-brand-surface/50 border border-brand-border text-brand-muted hover:text-white hover:border-purple-500/30 transition-all disabled:opacity-40">
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map((msg) => <Message key={msg.id} msg={msg} />)}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
              <Bot size={13} className="text-purple-400" />
            </div>
            <div className="bg-brand-surface/60 border border-brand-border rounded-2xl rounded-tl-sm px-3.5 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex gap-2 items-start bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
            <AlertCircle size={13} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-4 pt-2 border-t border-brand-border shrink-0">
        {!API_KEY && (
          <p className="text-[10px] text-amber-400 mb-2 text-center">
            Adicione <code className="font-mono">VITE_GEMINI_API_KEY</code> no .env e na Vercel
          </p>
        )}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Pergunte sobre produção, estoque..."
            disabled={loading || !API_KEY}
            className="flex-1 bg-brand-surface/60 border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-brand-muted focus:outline-none focus:border-purple-500/40 transition-all disabled:opacity-50"
          />
          <button onClick={() => send()} disabled={!input.trim() || loading || !API_KEY}
            className="w-9 h-9 flex items-center justify-center bg-purple-500/80 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-all">
            <Send size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
