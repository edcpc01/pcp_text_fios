import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Send, Bot, User, AlertCircle } from 'lucide-react';
import {
  useAppStore, usePlanningStore, useProductionStore, useAdminStore,
} from '../hooks/useStore';
import {
  subscribeRawMaterialStock, subscribeFinishedGoodsStock, subscribeForecast,
} from '../services/firebase';

// ─── Gemini API ───────────────────────────────────────────────────────────────
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = API_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`
  : null;

// ─── Quick actions ────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Resumo do mês',    query: 'Faça um resumo executivo da produção e planejamento do mês atual, destacando os pontos críticos.' },
  { label: 'Aderência',        query: 'Analise a aderência ao planejamento por produto. Quais estão abaixo da meta e qual a causa provável?' },
  { label: 'Estoque MP',       query: 'Como está o estoque de matéria-prima em relação à necessidade atual? Há risco de ruptura?' },
  { label: 'Forecast',         query: 'Compare o forecast de vendas com o estoque de produto acabado. Há déficits? Quais produtos precisam de atenção?' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function nowTime() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtKg(v) {
  if (v == null || isNaN(v)) return '—';
  if (v >= 1000) return `${(v / 1000).toFixed(1)}t`;
  return `${Math.round(v)} kg`;
}

function adherenceStatus(pct) {
  if (pct >= 95) return 'EXCELENTE';
  if (pct >= 85) return 'BOM';
  if (pct >= 70) return 'ATENÇÃO';
  return 'CRÍTICO';
}

function mpStatus(stock, need) {
  if (need <= 0) return 'SEM NECESSIDADE';
  const ratio = stock / need;
  if (ratio >= 1.1) return 'OK';
  if (ratio >= 0.7) return 'ATENÇÃO';
  return 'CRÍTICO';
}

// ─── System prompt com contexto real completo ─────────────────────────────────
function buildSystemPrompt(ctx) {
  const factoryLabel =
    ctx.factory === 'all'    ? 'Todas as Unidades (Corradi Matriz + Corradi Filial)' :
    ctx.factory === 'matriz' ? 'Corradi Matriz (empresa 09)' : 'Corradi Filial (empresa 07)';

  const lines = [];

  lines.push(`Você é um especialista em Gestão e Planejamento e Controle da Produção (PCP) de fios texturizados das empresas Corradi e Doptex.`);
  lines.push(`\nSua função é analisar os dados reais abaixo e dar respostas objetivas, orientadas a decisão, com foco em ações práticas de PCP. Auxilie gestores a tomar decisões sobre programação, priorização de ordens, gestão de materiais e cumprimento do forecast.`);
  lines.push(`\nREGRAS:`);
  lines.push(`- Responda SEMPRE em português brasileiro`);
  lines.push(`- Use APENAS os dados do contexto abaixo — nunca invente ou estime números ausentes`);
  lines.push(`- Seja direto: aponte riscos, desvios e ações recomendadas`);
  lines.push(`- Se um dado não estiver disponível no contexto, informe claramente e sugira o que sincronizar`);
  lines.push(`- Formate respostas com seções e listas para fácil leitura`);

  lines.push(`\n${'─'.repeat(60)}`);
  lines.push(`UNIDADE: ${factoryLabel}`);
  lines.push(`MÊS DE REFERÊNCIA: ${ctx.yearMonth}`);
  lines.push(`DATA ATUAL: ${new Date().toLocaleDateString('pt-BR')}`);

  // ── KPIs de produção
  lines.push(`\n=== KPIs DE PRODUÇÃO ===`);
  lines.push(`Total planejado no mês (mês completo): ${fmtKg(ctx.totalPlanned)}`);
  lines.push(`Planejado até D-1 (ontem inclusive): ${fmtKg(ctx.plannedD1)}`);
  lines.push(`Realizado até hoje (produtos planejados): ${fmtKg(ctx.totalActual)}`);
  lines.push(`Aderência geral (realizado ÷ planejado D-1): ${ctx.adherence}% — ${adherenceStatus(ctx.adherence)}`);
  if (ctx.totalPlanned > 0) {
    const restante = ctx.totalPlanned - ctx.totalActual;
    lines.push(`Volume ainda a produzir no mês: ${fmtKg(Math.max(0, restante))}`);
  }

  // ── Detalhamento por produto
  lines.push(`\n=== DETALHAMENTO POR PRODUTO (planejado D-1 vs realizado) ===`);
  if (ctx.productDetails.length > 0) {
    ctx.productDetails.forEach((p) => {
      lines.push(`• ${p.name}`);
      lines.push(`  Planejado D-1: ${fmtKg(p.planned)} | Realizado: ${fmtKg(p.actual)} | Aderência: ${p.pct}% [${adherenceStatus(p.pct)}]`);
      if (p.factory && ctx.factory === 'all') lines.push(`  Fábrica: ${p.factory === 'matriz' ? 'Corradi Matriz' : 'Corradi Filial'}`);
    });
  } else {
    lines.push('Sem dados de planejamento para o período.');
  }

  // ── Estoque MP
  lines.push(`\n=== ESTOQUE DE MATÉRIA-PRIMA vs NECESSIDADE ===`);
  if (ctx.mpItems.length > 0) {
    const criticas = ctx.mpItems.filter((m) => m.status === 'CRÍTICO');
    const atencao  = ctx.mpItems.filter((m) => m.status === 'ATENÇÃO');
    lines.push(`Total em estoque: ${fmtKg(ctx.totalMpKg)} | Total necessário no mês: ${fmtKg(ctx.totalMpNeed)}`);
    lines.push(`MPs críticas (<70% do estoque necessário): ${criticas.length}`);
    lines.push(`MPs em atenção (70–110%): ${atencao.length}`);
    lines.push('');
    ctx.mpItems.forEach((m) => {
      lines.push(`• ${m.desc} [${m.code || '—'}]`);
      lines.push(`  Estoque: ${fmtKg(m.stock)} | Necessidade mês: ${fmtKg(m.need)} | Necessidade atual (hoje em diante): ${fmtKg(m.needNow)} | Status: ${m.status}`);
      if (m.produtos.length > 0) lines.push(`  Usado em: ${m.produtos.slice(0, 3).join(', ')}${m.produtos.length > 3 ? ` +${m.produtos.length - 3}` : ''}`);
    });
  } else {
    lines.push('Dados de estoque MP não disponíveis. Sincronize o CSV de estoque na página Materiais para obter esta análise.');
  }

  // ── Estoque PA
  lines.push(`\n=== ESTOQUE DE PRODUTO ACABADO ===`);
  if (ctx.paItems.length > 0) {
    lines.push(`Total em estoque: ${fmtKg(ctx.totalPaKg)}`);
    ctx.paItems.forEach((p) => {
      lines.push(`• ${p.name} [cód. ${p.code || '—'}]: ${fmtKg(p.stock)}`);
    });
  } else {
    lines.push('Dados de estoque PA não disponíveis. Sincronize o CSV de estoque na página Materiais.');
  }

  // ── Forecast vs Estoque
  lines.push(`\n=== FORECAST VS ESTOQUE PA (mês ${ctx.yearMonth}) ===`);
  if (ctx.forecastItems.length > 0) {
    const deficits = ctx.forecastItems.filter((f) => f.delta < 0);
    lines.push(`Itens com déficit de cobertura: ${deficits.length}`);
    lines.push('');
    ctx.forecastItems.forEach((f) => {
      const sign = f.delta >= 0 ? '+' : '';
      lines.push(`• ${f.name} [cód. ${f.code}]`);
      lines.push(`  Forecast: ${fmtKg(f.forecast)} | Estoque PA: ${fmtKg(f.stock)} | Delta: ${sign}${fmtKg(f.delta)} [${f.delta >= 0 ? 'COBERTO' : 'DÉFICIT'}]`);
    });
  } else {
    lines.push('Sem dados de forecast cadastrados.');
  }

  return lines.join('\n');
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
            .replace(/### (.*)/g, '<strong class="text-purple-300">$1</strong>')
            .replace(/## (.*)/g, '<strong class="text-purple-300">$1</strong>')
            .replace(/# (.*)/g, '<strong class="text-purple-300">$1</strong>');
          return <p key={i} className={i > 0 ? 'mt-1' : ''} dangerouslySetInnerHTML={{ __html: html }} />;
        })}
        <p className="text-[10px] text-white/50 mt-1.5">{msg.time}</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AgentPanel({ mobileFullscreen = false }) {
  const { closeAgent, factory, getYearMonth } = useAppStore();
  const { entriesMap }          = usePlanningStore();
  const { records }             = useProductionStore();
  const { machines: adminMachines, products } = useAdminStore();

  const yearMonth = getYearMonth();

  // ── Subscrições locais de estoque e forecast ─────────────────────────────
  const [mpStock,      setMpStock]      = useState({});
  const [paStock,      setPaStock]      = useState({});
  const [forecastList, setForecastList] = useState([]);

  useEffect(() => {
    const u1 = subscribeRawMaterialStock(setMpStock);
    const u2 = subscribeFinishedGoodsStock(setPaStock);
    const u3 = subscribeForecast(setForecastList);
    return () => { u1(); u2(); u3(); };
  }, []);

  // ── Contexto calculado para o prompt ────────────────────────────────────
  const ctx = useMemo(() => {
    const today     = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Entries filtradas pela fábrica e mês
    const allEntries = Object.values(entriesMap).filter(
      (e) => (e.cellType === 'producao' || !e.cellType) &&
             (factory === 'all' || e.factory === factory),
    );

    // Par (produto, fábrica) com planejamento — evita dupla-contagem
    const plannedD1Pairs = new Set(
      allEntries
        .filter((e) => e.date && e.date.startsWith(yearMonth) && e.date <= yesterday)
        .map((e) => `${e.product}__${e.factory || 'matriz'}`)
        .filter(Boolean),
    );

    const totalPlanned = Math.round(allEntries.reduce((s, e) => s + (e.planned || 0), 0));
    const plannedD1    = Math.round(
      allEntries
        .filter((e) => e.date && e.date.startsWith(yearMonth) && e.date <= yesterday)
        .reduce((s, e) => s + (e.planned || 0), 0),
    );
    const totalActual = Math.round(
      records
        .filter((r) => plannedD1Pairs.has(`${r.product}__${r.factory || 'matriz'}`))
        .reduce((s, r) => s + (r.actual || 0), 0),
    );
    const adherence = plannedD1 > 0 ? Math.round((totalActual / plannedD1) * 100) : 0;

    // Detalhamento por produto (planejado D-1 vs realizado, agrupado por produto+fábrica)
    const productMap = {};
    allEntries
      .filter((e) => e.date && e.date.startsWith(yearMonth) && e.date <= yesterday)
      .forEach((e) => {
        const key = `${e.product}__${e.factory || 'matriz'}`;
        if (!productMap[key]) {
          productMap[key] = { name: e.productName || e.product || '—', planned: 0, actual: 0, factory: e.factory || 'matriz' };
        }
        productMap[key].planned += e.planned || 0;
      });
    records
      .filter((r) => plannedD1Pairs.has(`${r.product}__${r.factory || 'matriz'}`))
      .forEach((r) => {
        const key = `${r.product}__${r.factory || 'matriz'}`;
        if (productMap[key]) productMap[key].actual += r.actual || 0;
      });

    const productDetails = Object.values(productMap)
      .map((p) => ({ ...p, pct: p.planned > 0 ? Math.round((p.actual / p.planned) * 100) : 0 }))
      .sort((a, b) => b.planned - a.planned);

    // Necessidade de MP (mesma lógica do Materiais.jsx)
    const mpMap = {};
    allEntries.forEach((entry) => {
      const product = products.find((p) => p.id === entry.product || p.nome === entry.productName);
      if (!product) return;
      const kg = entry.planned || 0;
      if (!kg) return;
      const isFromToday = entry.date >= today;

      const accumulate = (mp, pct) => {
        if (!mp || (!mp.codigoMicrodata && !mp.descricao) || !pct || pct <= 0) return;
        const code = mp.codigoMicrodata || mp.descricao;
        if (!mpMap[code]) {
          mpMap[code] = { code: mp.codigoMicrodata || '', desc: mp.descricao || code, need: 0, needNow: 0, produtos: new Set() };
        }
        mpMap[code].need    += kg * (pct / 100);
        if (isFromToday) mpMap[code].needNow += kg * (pct / 100);
        mpMap[code].produtos.add(product.nome || product.id);
      };

      const useNew = ['mp1', 'mp2', 'mp3'].some((k) => product[k]?.descricao);
      if (useNew) {
        ['mp1', 'mp2', 'mp3'].forEach((k) => { if (product[k]?.descricao) accumulate(product[k], product[k].composicaoPct); });
      } else {
        if (product.alma?.composicaoPct > 0)   accumulate(product.alma,   product.alma.composicaoPct);
        if (product.efeito?.composicaoPct > 0)  accumulate(product.efeito, product.efeito.composicaoPct);
      }
    });

    const mpItems = Object.entries(mpMap).map(([code, m]) => {
      const stockData = mpStock[code] || mpStock[m.desc] || {};
      const stock = stockData.estoqueKg || 0;
      return {
        code: m.code,
        desc: m.desc,
        stock,
        need:    Math.round(m.need),
        needNow: Math.round(m.needNow),
        status:  mpStatus(stock, m.need),
        produtos: [...m.produtos],
      };
    }).sort((a, b) => b.need - a.need);

    const totalMpKg   = mpItems.reduce((s, m) => s + m.stock, 0);
    const totalMpNeed = mpItems.reduce((s, m) => s + m.need, 0);

    // Estoque PA
    const paItems = Object.values(paStock)
      .filter((p) => (p.estoqueKg || 0) > 0)
      .map((p) => ({ name: p.productName || '—', code: p.codigoMicrodata || '', stock: p.estoqueKg || 0 }))
      .sort((a, b) => b.stock - a.stock);
    const totalPaKg = paItems.reduce((s, p) => s + p.stock, 0);

    // Forecast vs Estoque PA
    const paStockByCode = {};
    Object.values(paStock).forEach((p) => {
      if (p.codigoMicrodata) paStockByCode[p.codigoMicrodata] = { name: p.productName || '—', stock: p.estoqueKg || 0 };
    });
    const forecastItems = forecastList
      .map((f) => {
        const forecastKg = f.months?.[yearMonth] || 0;
        if (!forecastKg) return null;
        const paEntry    = paStockByCode[f.code] || {};
        const stock      = paEntry.stock || 0;
        return { code: f.code, name: paEntry.name || f.code, forecast: forecastKg, stock, delta: stock - forecastKg };
      })
      .filter(Boolean)
      .sort((a, b) => a.delta - b.delta);

    return {
      factory, yearMonth, totalPlanned, plannedD1, totalActual, adherence,
      productDetails,
      mpItems, totalMpKg, totalMpNeed,
      paItems, totalPaKg,
      forecastItems,
    };
  }, [entriesMap, records, products, adminMachines, factory, yearMonth, mpStock, paStock, forecastList]);

  const [messages, setMessages] = useState([{
    id: 1, role: 'assistant', time: nowTime(),
    content: `Olá! Sou o especialista de PCP da Corradi/Doptex.\n\nTenho acesso ao planejamento, produção realizada, necessidade de MP, estoque de MP e PA, e forecast do mês atual. Como posso ajudar?`,
  }]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const bottomRef  = useRef(null);
  const historyRef = useRef([]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (query) => {
    const q = (query || input).trim();
    if (!q || loading) return;
    setInput('');
    setError(null);

    const userMsg = { id: Date.now(), role: 'user', content: q, time: nowTime() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    historyRef.current.push({ role: 'user', parts: [{ text: q }] });

    try {
      if (!GEMINI_URL) throw new Error('VITE_GEMINI_API_KEY não configurada.');

      const body = {
        contents: [
          { role: 'user',  parts: [{ text: buildSystemPrompt(ctx) }] },
          { role: 'model', parts: [{ text: 'Entendido. Tenho o contexto completo de PCP e estou pronto para analisar e recomendar ações.' }] },
          ...historyRef.current,
        ],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
      };

      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Erro ${res.status}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '(sem resposta)';

      historyRef.current.push({ role: 'model', parts: [{ text }] });

      setMessages((prev) => [...prev, {
        id: Date.now() + 1, role: 'assistant', content: text, time: nowTime(),
      }]);
    } catch (e) {
      setError(e.message);
      historyRef.current.pop();
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className={`flex flex-col shrink-0 z-20 animate-slide-right
      ${mobileFullscreen
        ? 'w-full h-full'
        : 'w-80 border-l border-brand-border glass fixed inset-y-0 right-0 md:relative'}`}>

      {/* Header */}
      <div className={`flex items-center gap-2.5 px-4 h-16 border-b border-brand-border shrink-0 ${mobileFullscreen ? 'hidden' : ''}`}>
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
            Adicione <code className="font-mono">VITE_GEMINI_API_KEY</code> no .env
          </p>
        )}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Pergunte sobre produção, estoque, forecast..."
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
