import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { X, Send, Bot, User, AlertCircle, Mic, MicOff, Camera } from 'lucide-react';
import {
  useAppStore, usePlanningStore, useProductionStore, useAdminStore, useCsvStore,
} from '../hooks/useStore';
import {
  subscribeRawMaterialStock, subscribeFinishedGoodsStock, subscribeForecast,
  subscribePlanningEntries,
} from '../services/firebase';
import { computeOEE } from '../pages/OEE';

// ─── Gemini API ───────────────────────────────────────────────────────────────
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = API_KEY
  ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`
  : null;

// ─── Quick actions ────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Resumo do mês', query: 'Faça um resumo executivo da produção e planejamento do mês atual, destacando os pontos críticos.' },
  { label: 'Aderência',     query: 'Analise a aderência ao planejamento por produto. Quais estão abaixo da meta e qual a causa provável?' },
  { label: 'OEE do mês',   query: 'Analise o OEE de produção do mês. Quais máquinas têm pior desempenho? Quais as principais causas e ações recomendadas?' },
  { label: 'Qualidade',     query: 'Analise os dados de qualidade do mês. Quais máquinas e produtos têm maior índice de 2ª qualidade e refugo? O que priorizar?' },
  { label: 'Estoque MP',    query: 'Como está o estoque de matéria-prima em relação à necessidade atual? Há risco de ruptura?' },
  { label: 'Forecast',      query: 'Compare o forecast de vendas com o estoque de produto acabado. Há déficits? Quais produtos precisam de atenção?' },
];

// ─── Quality tier helpers (mesma lógica da página Qualidade) ─────────────────
const SEGUNDA_SET = new Set(['A3', 'DV', '38']);
const REFUGO_SET  = new Set(['AS', 'EJ', 'EI', 'EM', 'EP']);

function getQualTier(classif, lote) {
  const c = (classif || '').toUpperCase().trim();
  if (REFUGO_SET.has(c))  return 'refugo';
  if (SEGUNDA_SET.has(c) || (lote || '').toUpperCase().endsWith('A')) return 'segunda';
  return 'primeira';
}

function csvEmpresaToFactory(emp) {
  const cod = String(emp || '').replace(/^0+/, '');
  if (cod === '9') return 'matriz';
  if (cod === '7') return 'filial';
  return 'outra';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function nowTime() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtKg(v) {
  if (v == null || isNaN(v)) return '—';
  if (v >= 1000) return `${(v / 1000).toFixed(1)}t`;
  return `${Math.round(v)} kg`;
}

function fmtPct(v) {
  if (v == null) return '—';
  return `${Math.min(100, v).toFixed(1)}%`;
}

function adherenceStatus(pct) {
  if (pct >= 95) return 'EXCELENTE';
  if (pct >= 85) return 'BOM';
  if (pct >= 70) return 'ATENÇÃO';
  return 'CRÍTICO';
}

function oeeStatus(pct) {
  if (pct >= 85) return 'WORLD CLASS';
  if (pct >= 65) return 'ACEITÁVEL';
  return 'CRÍTICO';
}

function mpStatus(stock, need) {
  if (need <= 0) return 'SEM NECESSIDADE';
  const ratio = stock / need;
  if (ratio >= 1.1) return 'OK';
  if (ratio >= 0.7) return 'ATENÇÃO';
  return 'CRÍTICO';
}

// ─── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(ctx) {
  const factoryLabel =
    ctx.factory === 'all'    ? 'Todas as Unidades (Corradi Matriz + Corradi Filial)' :
    ctx.factory === 'matriz' ? 'Corradi Matriz (empresa 09)' : 'Corradi Filial (empresa 07)';

  const lines = [];
  lines.push(`Você é um especialista em PCP de fios texturizados das empresas Corradi e Doptex.`);
  lines.push(`\nAnalise os dados reais abaixo e dê respostas objetivas, orientadas a decisão e ações práticas de PCP.`);
  lines.push(`\nREGRAS: Responda em português | Use apenas dados do contexto | Aponte riscos e ações | Formate com seções e listas | Se receber imagem, descreva e analise os dados visíveis.`);
  lines.push(`\n${'─'.repeat(60)}`);
  lines.push(`UNIDADE: ${factoryLabel} | MÊS: ${ctx.yearMonth} | HOJE: ${new Date().toLocaleDateString('pt-BR')}`);

  // KPIs de produção
  lines.push(`\n=== KPIs DE PRODUÇÃO ===`);
  lines.push(`Total planejado no mês: ${fmtKg(ctx.totalPlanned)}`);
  lines.push(`Planejado até D-1: ${fmtKg(ctx.plannedD1)}`);
  lines.push(`Realizado: ${fmtKg(ctx.totalActual)}`);
  lines.push(`Aderência: ${ctx.adherence}% — ${adherenceStatus(ctx.adherence)}`);
  if (ctx.totalPlanned > 0)
    lines.push(`Ainda a produzir: ${fmtKg(Math.max(0, ctx.totalPlanned - ctx.totalActual))}`);

  // Detalhamento por produto
  lines.push(`\n=== DETALHAMENTO POR PRODUTO ===`);
  if (ctx.productDetails.length > 0) {
    ctx.productDetails.forEach((p) => {
      lines.push(`• ${p.name}: plan ${fmtKg(p.planned)} | real ${fmtKg(p.actual)} | ader ${p.pct}% [${adherenceStatus(p.pct)}]${ctx.factory === 'all' ? ` | ${p.factory === 'matriz' ? 'Matriz' : 'Filial'}` : ''}`);
    });
  } else {
    lines.push('Sem dados de planejamento.');
  }

  // OEE
  lines.push(`\n=== OEE DE PRODUÇÃO (acumulado no mês) ===`);
  if (ctx.oeeData && Object.keys(ctx.oeeData).length > 0) {
    Object.entries(ctx.oeeData).forEach(([, fac]) => {
      lines.push(`\n${fac.label}: OEE ${fmtPct(fac.oee)} [${oeeStatus(fac.oee)}] | D ${fmtPct(fac.disponibilidade)} | P ${fmtPct(fac.performance)} | Q ${fac.qualidade != null ? fmtPct(fac.qualidade) : '—'}`);
      lines.push(`  Realizado: ${fmtKg(fac.actualKg)} | Teórico: ${fmtKg(fac.theoreticalKg)}`);
      if (fac.machines && Object.keys(fac.machines).length > 0) {
        Object.values(fac.machines)
          .sort((a, b) => a.oee - b.oee)
          .forEach((m) => {
            lines.push(`  • ${m.csvName}: OEE ${fmtPct(m.oee)} [${oeeStatus(m.oee)}] | D ${fmtPct(m.disponibilidade)} | P ${fmtPct(m.performance)} | Q ${m.qualidade != null ? fmtPct(m.qualidade) : '—'} | ${fmtKg(m.actualKg)} real / ${fmtKg(m.theoreticalKg)} teórico`);
          });
      }
    });
  } else {
    lines.push('Dados de OEE indisponíveis — verifique se há planejamento cadastrado para o mês.');
  }

  // Qualidade
  lines.push(`\n=== QUALIDADE DO MÊS (CSV) ===`);
  const qt = ctx.qualData?.total;
  if (qt && qt.total > 0) {
    const p1  = (qt.primeira / qt.total * 100).toFixed(1);
    const p2  = (qt.segunda  / qt.total * 100).toFixed(1);
    const pRef = (qt.refugo   / qt.total * 100).toFixed(1);
    lines.push(`Total: ${fmtKg(qt.total)} | 1ª: ${fmtKg(qt.primeira)} (${p1}%) | 2ª: ${fmtKg(qt.segunda)} (${p2}%) | Refugo: ${fmtKg(qt.refugo)} (${pRef}%)`);
    Object.entries(ctx.qualData.byFactory || {}).forEach(([, fac]) => {
      const fp1  = fac.total > 0 ? (fac.primeira / fac.total * 100).toFixed(1) : '0.0';
      const fp2  = fac.total > 0 ? (fac.segunda  / fac.total * 100).toFixed(1) : '0.0';
      const fRef = fac.total > 0 ? (fac.refugo   / fac.total * 100).toFixed(1) : '0.0';
      lines.push(`\n${fac.label}: ${fmtKg(fac.total)} | 1ª ${fp1}% | 2ª ${fp2}% | Refugo ${fRef}%`);
      Object.entries(fac.machines || {})
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 10)
        .forEach(([mName, md]) => {
          const mp1  = md.total > 0 ? (md.primeira / md.total * 100).toFixed(1) : '0';
          const mp2  = md.total > 0 ? (md.segunda  / md.total * 100).toFixed(1) : '0';
          const mRef = md.total > 0 ? (md.refugo   / md.total * 100).toFixed(1) : '0';
          lines.push(`  • ${mName}: ${fmtKg(md.total)} | 1ª ${mp1}% | 2ª ${mp2}% | Refugo ${mRef}%`);
        });
    });
  } else {
    lines.push('Dados de qualidade indisponíveis — sincronize o CSV na página Realizado.');
  }

  // Estoque MP
  lines.push(`\n=== ESTOQUE DE MATÉRIA-PRIMA vs NECESSIDADE ===`);
  if (ctx.mpItems.length > 0) {
    const criticas = ctx.mpItems.filter((m) => m.status === 'CRÍTICO');
    const atencao  = ctx.mpItems.filter((m) => m.status === 'ATENÇÃO');
    lines.push(`Estoque total: ${fmtKg(ctx.totalMpKg)} | Necessidade: ${fmtKg(ctx.totalMpNeed)} | Críticas: ${criticas.length} | Atenção: ${atencao.length}`);
    ctx.mpItems.forEach((m) => {
      lines.push(`• ${m.desc} [${m.code || '—'}]: est ${fmtKg(m.stock)} | nec ${fmtKg(m.need)} | atual ${fmtKg(m.needNow)} | ${m.status}`);
      if (m.produtos.length > 0) lines.push(`  Usado em: ${m.produtos.slice(0, 3).join(', ')}${m.produtos.length > 3 ? ` +${m.produtos.length - 3}` : ''}`);
    });
  } else {
    lines.push('Estoque MP indisponível — sincronize o CSV na página Materiais.');
  }

  // Estoque PA
  lines.push(`\n=== ESTOQUE DE PRODUTO ACABADO ===`);
  if (ctx.paItems.length > 0) {
    lines.push(`Total: ${fmtKg(ctx.totalPaKg)}`);
    ctx.paItems.forEach((p) => lines.push(`• ${p.name} [${p.code || '—'}]: ${fmtKg(p.stock)}`));
  } else {
    lines.push('Estoque PA indisponível — sincronize o CSV na página Materiais.');
  }

  // Forecast
  lines.push(`\n=== FORECAST VS ESTOQUE PA ===`);
  if (ctx.forecastItems.length > 0) {
    const deficits = ctx.forecastItems.filter((f) => f.delta < 0);
    lines.push(`Itens com déficit: ${deficits.length}`);
    ctx.forecastItems.forEach((f) => {
      const sign = f.delta >= 0 ? '+' : '';
      lines.push(`• ${f.name} [${f.code}]: forecast ${fmtKg(f.forecast)} | PA ${fmtKg(f.stock)} | delta ${sign}${fmtKg(f.delta)} [${f.delta >= 0 ? 'COBERTO' : 'DÉFICIT'}]`);
    });
  } else {
    lines.push('Sem dados de forecast.');
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
        {msg.hasImage && (
          <p className="text-[10px] text-brand-cyan/70 mb-1.5 flex items-center gap-1">
            <Camera size={9} /> print da tela anexado
          </p>
        )}
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
  const { entriesMap }                        = usePlanningStore();
  const { records }                           = useProductionStore();
  const { machines: adminMachines, products } = useAdminStore();
  const { rows: csvRows }                     = useCsvStore();

  const yearMonth = getYearMonth();

  // ── Firebase subscriptions ───────────────────────────────────────────────
  const [mpStock,         setMpStock]         = useState({});
  const [paStock,         setPaStock]         = useState({});
  const [forecastList,    setForecastList]    = useState([]);
  const [planningEntries, setPlanningEntries] = useState([]);

  useEffect(() => {
    const u1 = subscribeRawMaterialStock(setMpStock);
    const u2 = subscribeFinishedGoodsStock(setPaStock);
    const u3 = subscribeForecast(setForecastList);
    return () => { u1(); u2(); u3(); };
  }, []);

  useEffect(() => {
    const unsub = subscribePlanningEntries(factory, yearMonth, setPlanningEntries);
    return () => unsub();
  }, [factory, yearMonth]);

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

    // ── OEE ──────────────────────────────────────────────────────────────
    const lastDay = new Date(Number(yearMonth.split('-')[0]), Number(yearMonth.split('-')[1]), 0).getDate();
    const isCurrentMonth = yearMonth === today.slice(0, 7);
    const cutoff = isCurrentMonth ? today : `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
    let oeeData = {};
    try {
      oeeData = computeOEE({ planningEntries, csvRows, adminMachines, adminProducts: products, factory, yearMonth, cutoff });
    } catch (_) { /* sem dados */ }

    // ── Qualidade do CSV ──────────────────────────────────────────────────
    const FACTORY_LABELS = { matriz: 'Corradi Matriz', filial: 'Corradi Filial', outra: 'Outras' };
    const qualData = { total: { primeira: 0, segunda: 0, refugo: 0, total: 0 }, byFactory: {} };
    csvRows
      .filter((r) => r.date && r.date.startsWith(yearMonth) && (factory === 'all' || csvEmpresaToFactory(r.empresa) === factory))
      .forEach((r) => {
        const tier  = getQualTier(r.classif, r.lote);
        const kg    = r.quantity || 0;
        qualData.total[tier]  += kg;
        qualData.total.total  += kg;
        const fKey = csvEmpresaToFactory(r.empresa);
        if (!qualData.byFactory[fKey]) {
          qualData.byFactory[fKey] = { label: FACTORY_LABELS[fKey] || fKey, primeira: 0, segunda: 0, refugo: 0, total: 0, machines: {} };
        }
        qualData.byFactory[fKey][tier]  += kg;
        qualData.byFactory[fKey].total  += kg;
        const mName = r.machine || '(sem máquina)';
        if (!qualData.byFactory[fKey].machines[mName])
          qualData.byFactory[fKey].machines[mName] = { primeira: 0, segunda: 0, refugo: 0, total: 0 };
        qualData.byFactory[fKey].machines[mName][tier]  += kg;
        qualData.byFactory[fKey].machines[mName].total  += kg;
      });

    // ── Necessidade de MP (mesma lógica do Materiais.jsx) ─────────────────
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
      productDetails, oeeData, qualData,
      mpItems, totalMpKg, totalMpNeed,
      paItems, totalPaKg,
      forecastItems,
    };
  }, [entriesMap, records, products, adminMachines, factory, yearMonth,
      mpStock, paStock, forecastList, planningEntries, csvRows]);

  const [messages, setMessages] = useState([{
    id: 1, role: 'assistant', time: nowTime(),
    content: `Olá! Sou o especialista de PCP da Corradi/Doptex.\n\nTenho acesso completo a:\n• Planejamento e produção realizada\n• OEE (Disponibilidade, Performance, Qualidade)\n• Qualidade do CSV (1ª, 2ª, Refugo por máquina)\n• Estoque de MP e PA, Forecast\n\nPosso responder por texto ou voz 🎤. Use 📷 para enviar o print da tela. Como posso ajudar?`,
  }]);
  const [input,          setInput]          = useState('');
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);
  const [listening,      setListening]      = useState(false);
  const [pendingImage,   setPendingImage]   = useState(null);
  const [captureLoading, setCaptureLoading] = useState(false);
  const bottomRef  = useRef(null);
  const historyRef = useRef([]);
  const recognRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Voice input ────────────────────────────────────────────────────────────
  const SR = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

  const toggleVoice = useCallback(() => {
    if (!SR) return;
    if (listening) { recognRef.current?.stop(); setListening(false); return; }
    const recog = new SR();
    recog.lang = 'pt-BR';
    recog.interimResults = false;
    recog.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript || '';
      setInput((prev) => (prev ? `${prev} ${t}` : t));
    };
    recog.onend  = () => setListening(false);
    recog.onerror = () => setListening(false);
    recognRef.current = recog;
    recog.start();
    setListening(true);
  }, [SR, listening]);

  // ── Screenshot ─────────────────────────────────────────────────────────────
  const captureScreen = useCallback(async () => {
    setCaptureLoading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const root = document.getElementById('root') || document.body;
      const canvas = await html2canvas(root, { useCORS: true, allowTaint: true, scale: 0.55, logging: false });
      setPendingImage(canvas.toDataURL('image/jpeg', 0.75).split(',')[1]);
    } catch (e) {
      setError('Não foi possível capturar a tela: ' + e.message);
    } finally {
      setCaptureLoading(false);
    }
  }, []);

  // ── Send ────────────────────────────────────────────────────────────────────
  const send = async (query) => {
    const q = (query || input).trim();
    const imgToSend = pendingImage;
    if ((!q && !imgToSend) || loading) return;
    setInput('');
    setError(null);
    if (imgToSend) setPendingImage(null);

    const displayText = q || 'Analise o print da tela atual.';
    const userMsg = { id: Date.now(), role: 'user', content: displayText, time: nowTime(), hasImage: !!imgToSend };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const parts = [];
    if (imgToSend) parts.push({ inlineData: { mimeType: 'image/jpeg', data: imgToSend } });
    parts.push({ text: q || 'Analise o que está visível na aplicação PCP e forneça insights relevantes sobre os dados mostrados.' });
    historyRef.current.push({ role: 'user', parts });

    try {
      if (!GEMINI_URL) throw new Error('VITE_GEMINI_API_KEY não configurada.');

      const body = {
        contents: [
          { role: 'user',  parts: [{ text: buildSystemPrompt(ctx) }] },
          { role: 'model', parts: [{ text: 'Entendido. Tenho o contexto completo de PCP (produção, OEE, qualidade, estoques, forecast) e estou pronto para analisar.' }] },
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
              {API_KEY ? 'Gemini Flash · Voz · Visão' : 'API key não configurada'}
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

      {/* Pending image preview */}
      {pendingImage && (
        <div className="px-3 pb-1 pt-2 shrink-0">
          <div className="relative inline-block">
            <img
              src={`data:image/jpeg;base64,${pendingImage}`}
              alt="screenshot"
              className="h-16 rounded-lg border border-brand-cyan/30 object-cover"
            />
            <button
              onClick={() => setPendingImage(null)}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-400 transition-colors">
              <X size={9} />
            </button>
          </div>
          <p className="text-[9px] text-brand-cyan/60 mt-0.5">Print anexado — será enviado com a próxima mensagem</p>
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-4 pt-2 border-t border-brand-border shrink-0">
        {!API_KEY && (
          <p className="text-[10px] text-amber-400 mb-2 text-center">
            Adicione <code className="font-mono">VITE_GEMINI_API_KEY</code> no .env
          </p>
        )}
        <div className="flex gap-1.5">
          {/* Mic */}
          <button
            onClick={toggleVoice}
            disabled={!SR || loading || !API_KEY}
            title={SR ? 'Clique para falar' : 'Reconhecimento de voz indisponível neste navegador'}
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all disabled:opacity-30 shrink-0
              ${listening
                ? 'bg-red-500/80 hover:bg-red-500 text-white animate-pulse'
                : 'bg-brand-surface/60 border border-brand-border text-brand-muted hover:text-white hover:border-purple-500/40'}`}>
            {listening ? <MicOff size={14} /> : <Mic size={14} />}
          </button>

          {/* Screenshot */}
          <button
            onClick={captureScreen}
            disabled={captureLoading || loading || !API_KEY}
            title="Capturar tela atual e enviar ao agente"
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all disabled:opacity-30 shrink-0
              ${pendingImage
                ? 'bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan'
                : 'bg-brand-surface/60 border border-brand-border text-brand-muted hover:text-white hover:border-purple-500/40'}
              ${captureLoading ? 'animate-pulse' : ''}`}>
            <Camera size={14} />
          </button>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={listening ? 'Ouvindo...' : 'Pergunte sobre OEE, qualidade, estoque...'}
            disabled={loading || !API_KEY}
            className="flex-1 bg-brand-surface/60 border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-brand-muted focus:outline-none focus:border-purple-500/40 transition-all disabled:opacity-50"
          />
          <button
            onClick={() => send()}
            disabled={(!input.trim() && !pendingImage) || loading || !API_KEY}
            className="w-9 h-9 flex items-center justify-center bg-purple-500/80 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-all shrink-0">
            <Send size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
