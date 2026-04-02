import { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User, Sparkles, RefreshCw, Database } from 'lucide-react';
import { useAppStore } from '../hooks/useStore';

const QUICK_ACTIONS = [
  { label: 'Produção de hoje', query: 'Qual foi a produção de hoje?' },
  { label: 'Aderência do mês', query: 'Como está a aderência ao planejamento neste mês?' },
  { label: 'Máquinas críticas', query: 'Quais máquinas estão com aderência abaixo de 80%?' },
  { label: 'Sincronizar dados', query: 'Sincronize os dados de produção do Microdata.' },
];

const MOCK_RESPONSES = {
  default: (factory) => `Olá! Sou o agente de produção da fábrica **${factory === 'doptex' ? 'Doptex' : 'Corradi'}**. Posso consultar dados de produção, calcular aderências e sincronizar com o sistema Microdata.\n\nComo posso ajudar?`,
  producao: () => `📊 **Produção de Hoje**\n\nDados simulados (agente Microdata ainda não conectado):\n\n• Total produzido: **4.280 kg**\n• Planejado: **4.640 kg**\n• Aderência: **92,2%** ✅\n\nMáquinas em destaque:\n• M05: 98% ✅\n• M08: 95% ✅\n• M03: 78% ⚠️`,
  aderencia: () => `📈 **Aderência do Mês**\n\nResumo acumulado:\n\n• Meta: ≥ 90%\n• Realizado: **88,4%** ⚠️\n\nPor faixa:\n• ✅ Excelente (≥95%): 4 máquinas\n• 🟡 Bom (85-95%): 5 máquinas\n• 🟠 Atenção (70-85%): 2 máquinas\n• 🔴 Crítico (<70%): 0 máquinas`,
  criticas: () => `⚠️ **Máquinas com Aderência < 80%**\n\nNenhuma máquina crítica no momento.\n\nMáquinas em atenção (80-85%):\n• M03 — DTY 75/36 — 82%\n• M07 — ATY 200/48 — 81%\n\nRecomendação: verificar ajuste de parâmetros.`,
  sincronizar: () => `🔄 **Sincronização Microdata**\n\nO agente ainda não está conectado ao Microdata. Quando configurado, irá:\n\n1. Buscar produção real do ERP\n2. Comparar com o planejamento\n3. Salvar registros no Firestore\n\nAguarde a configuração da API.`,
};

function getResponse(query, factory) {
  const q = query.toLowerCase();
  if (q.includes('hoje') || q.includes('produção')) return MOCK_RESPONSES.producao();
  if (q.includes('aderência') || q.includes('mes') || q.includes('mês')) return MOCK_RESPONSES.aderencia();
  if (q.includes('críti') || q.includes('abaixo') || q.includes('máquinas')) return MOCK_RESPONSES.criticas();
  if (q.includes('sincroniz')) return MOCK_RESPONSES.sincronizar();
  return MOCK_RESPONSES.default(factory);
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5
        ${isUser ? 'bg-brand-cyan/20' : 'bg-purple-500/20'}`}>
        {isUser ? <User size={13} className="text-brand-cyan" /> : <Bot size={13} className="text-purple-400" />}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
        ${isUser
          ? 'bg-brand-cyan/20 text-white rounded-tr-sm'
          : 'bg-brand-surface/60 text-white rounded-tl-sm border border-brand-border'}`}>
        {msg.content.split('\n').map((line, i) => {
          const bold = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          return <p key={i} className={i > 0 ? 'mt-1' : ''} dangerouslySetInnerHTML={{ __html: bold }} />;
        })}
        <p className="text-[10px] text-white mt-1.5">{msg.time}</p>
      </div>
    </div>
  );
}

export default function AgentPanel() {
  const { closeAgent, factory } = useAppStore();
  const [messages, setMessages] = useState([
    {
      id: 1, role: 'assistant', time: now(),
      content: `Olá! Sou o agente de produção. Posso consultar dados do Microdata, calcular aderências e sincronizar registros.\n\nComo posso ajudar?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function now() {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  const send = async (query) => {
    const q = query || input.trim();
    if (!q || loading) return;
    setInput('');

    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', content: q, time: now() }]);
    setLoading(true);

    await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));

    setMessages((prev) => [...prev, {
      id: Date.now() + 1, role: 'assistant',
      content: getResponse(q, factory),
      time: now(),
    }]);
    setLoading(false);
  };

  return (
    <aside className="w-80 border-l border-brand-border glass flex flex-col shrink-0 animate-slide-right z-20
      fixed inset-y-0 right-0 md:relative">

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-brand-border shrink-0">
        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
          <Bot size={15} className="text-purple-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Agente Microdata</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[10px] text-white">Modo simulado</span>
          </div>
        </div>
        <button onClick={closeAgent} className="p-1.5 text-white hover:text-white hover:bg-white/[0.05] rounded-lg transition-all">
          <X size={14} />
        </button>
      </div>

      {/* Quick actions */}
      <div className="px-3 py-2.5 border-b border-brand-border shrink-0">
        <p className="text-[10px] text-white uppercase tracking-wider mb-2">Ações rápidas</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              onClick={() => send(a.query)}
              disabled={loading}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-brand-surface/50 border border-brand-border text-white hover:text-white hover:border-brand-border transition-all disabled:opacity-40"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map((msg) => <Message key={msg.id} msg={msg} />)}
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
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-4 pt-2 border-t border-brand-border shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Pergunte algo..."
            disabled={loading}
            className="flex-1 bg-brand-surface/60 border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white focus:outline-none focus:border-purple-500/40 transition-all disabled:opacity-50"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-9 h-9 flex items-center justify-center bg-purple-500/80 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-all"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
