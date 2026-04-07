import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlaskConical, Package, ChevronLeft, ChevronRight, Pencil, Check, X,
  TrendingDown, AlertTriangle, CheckCircle2, Layers, RefreshCw, Loader2, FolderOpen, ChevronDown,
} from 'lucide-react';
import { useAppStore, useAdminStore, usePlanningStore, useAuthStore } from '../hooks/useStore';
import {
  subscribePlanningEntries,
  subscribeRawMaterialStock, saveRawMaterialStock,
  subscribeFinishedGoodsStock, saveFinishedGoodStock,
} from '../services/firebase';
import { getMonthLabel } from '../utils/dates';
import { pickOrReuseFile, clearFileHandle, readSavedFile, parseEstoqueCSV, findProductByCode } from '../utils/csvSync';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtKg(v) {
  if (v == null || isNaN(v)) return '—';
  if (v >= 1000) return `${(v / 1000).toFixed(1)}t`;
  return `${Math.round(v)} kg`;
}

function statusInfo(estoque, necessidade) {
  if (necessidade <= 0) return { label: 'Sem necessidade', color: '#64748b', icon: null, bg: 'rgba(100,116,139,0.08)' };
  const ratio = estoque / necessidade;
  if (ratio >= 1.1) return { label: 'OK', color: '#10b981', icon: CheckCircle2, bg: 'rgba(16,185,129,0.08)' };
  if (ratio >= 0.7) return { label: 'Atenção', color: '#f59e0b', icon: AlertTriangle, bg: 'rgba(245,158,11,0.08)' };
  return { label: 'Crítico', color: '#ef4444', icon: TrendingDown, bg: 'rgba(239,68,68,0.08)' };
}

// ─── Inline editable stock value ──────────────────────────────────────────────

function InlineEdit({ value, onSave, label = 'Editar estoque', editable = true }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEdit = () => { if (editable) { setDraft(String(value ?? '')); setEditing(true); } };
  const cancel = () => setEditing(false);
  const confirm = async () => { await onSave(Number(draft) || 0); setEditing(false); };

  if (editing && editable) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          autoFocus
          type="number"
          min={0}
          className="w-24 bg-brand-surface border border-brand-cyan/40 rounded-lg px-2 py-0.5 text-sm text-white font-mono focus:outline-none focus:border-brand-cyan"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') cancel(); }}
        />
        <span className="text-xs text-brand-muted">kg</span>
        <button onClick={confirm} className="p-0.5 text-brand-success hover:text-green-300 transition-colors"><Check size={13} /></button>
        <button onClick={cancel}  className="p-0.5 text-brand-muted hover:text-white transition-colors"><X size={13} /></button>
      </span>
    );
  }

  if (!editable) {
    return (
      <span className="text-white font-mono font-bold">
        {fmtKg(value)}
      </span>
    );
  }

  return (
    <button
      onClick={startEdit}
      className="group inline-flex items-center gap-1.5 text-white font-mono font-bold hover:text-brand-cyan transition-colors"
      title={label}
    >
      {fmtKg(value)}
      <Pencil size={11} className="text-brand-muted opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ─── Lotes Expander ───────────────────────────────────────────────────────────

function LotesExpander({ lots }) {
  const [open, setOpen] = useState(false);
  if (!lots || lots.length === 0) return null;

  return (
    <div className="border-t border-brand-border pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] font-bold text-brand-muted uppercase tracking-widest hover:text-brand-cyan transition-colors w-full"
      >
        <ChevronDown size={11} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        {lots.length} {lots.length === 1 ? 'Lote disponível' : 'Lotes disponíveis'}
      </button>

      {open && (
        <div className="mt-2 space-y-1 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
          <div className="grid grid-cols-[1fr_2rem_4rem] text-[9px] text-brand-muted font-bold uppercase tracking-widest pb-1 border-b border-brand-border/50">
            <span>Lote</span>
            <span className="text-center">Emp.</span>
            <span className="text-right">Peso</span>
          </div>
          {lots.map((lot, i) => (
            <div key={i} className="grid grid-cols-[1fr_2rem_4rem] items-center text-[11px] py-0.5 hover:bg-white/5 rounded px-1 -mx-1 transition-colors">
              <span className="font-mono text-white truncate" title={lot.lote}>{lot.lote || '—'}</span>
              <span className="text-brand-muted text-center">{lot.empresa || '—'}</span>
              <span className="font-mono font-bold text-brand-cyan text-right">{fmtKg(lot.pesoKg)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MP Card ──────────────────────────────────────────────────────────────────

function MpCard({ mp, stock, onSaveStock, editable }) {
  const estoque = stock?.estoqueKg ?? 0;
  const { label, color, icon: StatusIcon, bg } = statusInfo(estoque, mp.necessidadeKg);
  const pct = mp.necessidadeKg > 0 ? Math.min(100, Math.round((estoque / mp.necessidadeKg) * 100)) : 100;
  const saldo = estoque - mp.necessidadeKg;

  return (
    <div
      className="bg-brand-card border border-brand-border rounded-2xl p-5 flex flex-col gap-4 card-hover relative overflow-hidden transition-all"
      style={{ borderTop: `2px solid ${color}` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-1">Matéria-Prima</p>
          <p className="text-sm font-semibold text-white leading-tight truncate" title={mp.descricao}>{mp.descricao}</p>
          {mp.codigoMicrodata && (
            <p className="text-[11px] text-brand-muted mt-0.5 font-mono">Cód. {mp.codigoMicrodata}</p>
          )}
        </div>
        <span
          className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg"
          style={{ backgroundColor: bg, color }}
        >
          {StatusIcon && <StatusIcon size={10} />}
          {label}
        </span>
      </div>

      {/* Barra */}
      <div>
        <div className="flex justify-between text-[10px] text-brand-muted mb-1.5">
          <span>Estoque vs Necessidade</span>
          <span style={{ color }}>{pct}%</span>
        </div>
        <div className="h-2 bg-brand-surface rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      </div>

      {/* Valores */}
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="bg-brand-surface rounded-xl p-2.5">
          <p className="text-[9px] text-brand-muted uppercase tracking-widest mb-1">Necessidade</p>
          <p className="text-base font-mono font-bold text-white">{fmtKg(mp.necessidadeKg)}</p>
        </div>
        <div className="bg-brand-surface rounded-xl p-2.5">
          <p className="text-[9px] text-brand-muted uppercase tracking-widest mb-1">Estoque (Microdata)</p>
          <InlineEdit
            value={estoque}
            label={editable ? "Clique para editar o estoque" : "Estoque atual"}
            editable={editable}
            onSave={(v) => onSaveStock(mp.codigoMicrodata, { descricao: mp.descricao, estoqueKg: v })}
          />
        </div>
      </div>

      {/* Saldo */}
      <div className="flex items-center justify-between border-t border-brand-border pt-3 text-xs">
        <span className="text-brand-muted">Saldo</span>
        <span className="font-mono font-bold" style={{ color: saldo >= 0 ? '#10b981' : '#ef4444' }}>
          {saldo >= 0 ? '+' : ''}{fmtKg(saldo)}
        </span>
      </div>

      {/* Produtos que usam */}
      <div className="text-[10px] text-brand-muted">
        {mp.produtos.length > 0 && (
          <span>Usado em: {mp.produtos.slice(0, 3).join(', ')}{mp.produtos.length > 3 ? ` +${mp.produtos.length - 3}` : ''}</span>
        )}
      </div>

      {/* Lotes */}
      <LotesExpander lots={stock?.lots} />
    </div>
  );
}

// ─── Finished Good Card ───────────────────────────────────────────────────────

function PaCard({ product, stock, onSaveStock, editable }) {
  const estoqueKg = stock?.estoqueKg ?? 0;

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-4 card-hover" style={{ borderTop: '2px solid #8b5cf6' }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-0.5">Produto Acabado</p>
          <p className="text-sm font-semibold text-white truncate">{product.nome}</p>
          <p className="text-[11px] font-mono text-brand-muted mt-0.5">Cód. {product.codigoMicrodata || '—'}</p>
        </div>
        <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-violet-500/10 text-violet-400 shrink-0">
          {product.composicao || product.type || '—'}
        </span>
      </div>
      <div className="bg-brand-surface rounded-xl p-3 text-center">
        <p className="text-[9px] text-brand-muted uppercase tracking-widest mb-1">Estoque (Microdata)</p>
        <InlineEdit
          value={estoqueKg}
          label={editable ? "Clique para editar o estoque de PA" : "Estoque atual"}
          editable={editable}
          onSave={(v) => onSaveStock(product.id, { productName: product.nome, estoqueKg: v })}
        />
      </div>
      {product.comprimentoEnrolamento && (
        <p className="text-[10px] text-brand-muted mt-2 text-center">
          {product.tituloDtex} dtex · {product.comprimentoEnrolamento}m/bobina
        </p>
      )}

      {/* Lotes */}
      <LotesExpander lots={stock?.lots} />
    </div>
  );
}

// ─── Date Range Filter ────────────────────────────────────────────────────────

function DateRangeFilter({ dateRange, setDateRange, showPicker, setShowPicker, monthLabel }) {
  const { changeMonth } = useAppStore();
  const hasRange = dateRange.start && dateRange.end;

  return (
    <div className="flex bg-brand-surface border border-brand-border rounded-lg p-1 relative">
      <div className="flex items-center space-x-1">
        <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-brand-card rounded text-brand-muted hover:text-white transition-colors">
          <ChevronLeft size={18} />
        </button>
        <span
          className="text-sm font-medium text-white px-3 capitalize min-w-[140px] text-center cursor-pointer select-none hover:text-brand-cyan transition-colors"
          onDoubleClick={() => setShowPicker(true)}
          title="Duplo clique para filtrar período específico"
        >
          {hasRange
            ? `${dateRange.start.split('-').reverse().join('/')} → ${dateRange.end.split('-').reverse().join('/')}`
            : monthLabel}
        </span>
        <button onClick={() => changeMonth(1)} className="p-1 hover:bg-brand-card rounded text-brand-muted hover:text-white transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      {showPicker && (
        <div className="absolute top-[calc(100%+0.5rem)] right-0 z-50 bg-brand-card border border-brand-border rounded-xl p-4 shadow-xl flex flex-col gap-3 animate-fade-in shadow-black/50 min-w-[260px]">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-brand-muted uppercase font-bold tracking-widest">Data Inicial</label>
              <input
                type="date"
                className="bg-brand-surface text-white text-sm rounded border border-brand-border p-2 focus:outline-none focus:border-brand-cyan"
                value={dateRange.start}
                onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-brand-muted uppercase font-bold tracking-widest">Data Final</label>
              <input
                type="date"
                className="bg-brand-surface text-white text-sm rounded border border-brand-border p-2 focus:outline-none focus:border-brand-cyan"
                value={dateRange.end}
                min={dateRange.start}
                onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-1">
            <button onClick={() => { setDateRange({ start: '', end: '' }); setShowPicker(false); }}
              className="text-xs text-brand-muted hover:text-white px-3 py-1.5 rounded transition-colors">Limpar</button>
            <button onClick={() => setShowPicker(false)}
              className="text-xs bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 font-bold rounded px-4 py-1.5 hover:bg-brand-cyan/20 transition-colors">Aplicar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Materiais() {
  const { user } = useAuthStore();
  const { factory, month, getYearMonth } = useAppStore();
  const { products } = useAdminStore();
  const { entriesMap, setEntriesFromArray } = usePlanningStore();
  const isSupervisor = user?.role === 'supervisor';

  const yearMonth = getYearMonth();
  const monthLabel = getMonthLabel(month.year, month.month);

  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showPicker, setShowPicker] = useState(false);
  const [mpStock, setMpStock]   = useState({});
  const [paStock, setPaStock]   = useState({});
  const [importing, setImporting] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const fallbackInputRef = useRef(null);

  const CSV_HANDLE_KEY = 'estoque-csv';

  const processEstoqueText = async (text, mpNecessidadeLocal) => {
    const rows = parseEstoqueCSV(text);
    if (rows.length === 0) {
      setSyncResult({ mp: 0, pa: 0, skipped: 0, error: 'Arquivo vazio ou formato não reconhecido.' });
      setImporting(false);
      return;
    }

    // Monta lookup map do CSV: código (lowercase) → row e descrição (lowercase) → row
    // Assim podemos buscar a partir dos códigos do app, não do CSV
    const csvByCode = {};
    const csvByDesc = {};
    for (const row of rows) {
      if (row.code) csvByCode[row.code.toLowerCase()] = row;
      if (row.description) csvByDesc[row.description.toLowerCase()] = row;
    }

    const findInCsv = (code, desc) => {
      if (code) {
        const match = csvByCode[String(code).toLowerCase()];
        if (match) return match;
      }
      if (desc) {
        // Busca exata pela descrição
        const exact = csvByDesc[String(desc).toLowerCase()];
        if (exact) return exact;
        // Busca parcial: descrição do app contida na descrição do CSV ou vice-versa
        const descNorm = String(desc).toLowerCase();
        const partial = Object.entries(csvByDesc).find(
          ([k]) => k.includes(descNorm) || descNorm.includes(k),
        );
        if (partial) return partial[1];
      }
      return null;
    };

    let mp = 0, pa = 0, skipped = 0;

    // 1. Atualiza estoque de MPs — drive a partir dos MPs cadastrados/planejados no app
    for (const m of (mpNecessidadeLocal || [])) {
      const match = findInCsv(m.codigoMicrodata, m.descricao);
      if (match) {
        const key = m.codigoMicrodata || m.descricao;
        await saveRawMaterialStock(key, { descricao: m.descricao || match.description, estoqueKg: match.stockKg, lots: match.lots || [] });
        mp++;
      } else {
        skipped++;
      }
    }

    // 2. Atualiza estoque de PAs — drive a partir dos produtos cadastrados no app
    for (const product of products) {
      const match = findInCsv(product.codigoMicrodata, product.nome);
      if (match) {
        await saveFinishedGoodStock(product.id, { productName: product.nome, estoqueKg: match.stockKg, lots: match.lots || [] });
        pa++;
      }
    }

    setSyncResult({ mp, pa, skipped });
    setImporting(false);
  };

  const handleSync = async (mpNecessidadeLocal) => {
    if (importing) return;
    setImporting(true);
    setSyncResult(null);

    if (window.showOpenFilePicker) {
      try {
        const file = await pickOrReuseFile(CSV_HANDLE_KEY);
        if (!file) { setImporting(false); return; }
        const text = await file.text();
        await processEstoqueText(text, mpNecessidadeLocal);
      } catch (err) {
        setSyncResult({ error: err.message });
        setImporting(false);
      }
    } else {
      fallbackInputRef.current?.click();
    }
  };

  const handleFallbackFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) { setImporting(false); return; }
    const text = await file.text();
    await processEstoqueText(text, []);
    e.target.value = '';
  };

  // Reset range on month change
  useEffect(() => { setDateRange({ start: '', end: '' }); setShowPicker(false); }, [yearMonth]);

  // Subscribe planning entries for current month + factory
  useEffect(() => {
    const unsub = subscribePlanningEntries(factory, yearMonth, (data) => {
      setEntriesFromArray(data);
    });
    return unsub;
  }, [factory, yearMonth]);

  // Subscribe MP & PA stock (global, not factory-specific)
  useEffect(() => {
    const unsubMp = subscribeRawMaterialStock(setMpStock);
    const unsubPa = subscribeFinishedGoodsStock(setPaStock);
    return () => { unsubMp(); unsubPa(); };
  }, []);

  // ─── Auto-sync estoque (a cada 5 min, sem interação do usuário) ─────────────
  const [lastAutoSync, setLastAutoSync] = useState(null);
  const AUTO_SYNC_INTERVAL = 5 * 60 * 1000;
  // Ref para acessar mpNecessidade atual no interval sem criar nova closure
  const mpNecessidadeRef = useRef([]);

  useEffect(() => {
    const autoSync = async () => {
      if (importing) return;
      const file = await readSavedFile(CSV_HANDLE_KEY);
      if (!file) return;
      try {
        const text = await file.text();
        // Chama processEstoqueText com o mpNecessidade atual via ref
        await processEstoqueText(text, mpNecessidadeRef.current);
        setLastAutoSync(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      } catch { /* falha silenciosa */ }
    };

    autoSync();
    const interval = setInterval(autoSync, AUTO_SYNC_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const hasRange = dateRange.start && dateRange.end;

  // Filter planning entries by period
  const planningEntries = useMemo(() => {
    const all = Object.values(entriesMap).filter(
      (e) => (e.cellType === 'producao' || !e.cellType) &&
             (factory === 'all' || e.factory === factory),
    );
    if (!hasRange) return all;
    return all.filter((e) => e.date >= dateRange.start && e.date <= dateRange.end);
  }, [entriesMap, factory, hasRange, dateRange]);

  // Build MP necessity map
  const mpNecessidade = useMemo(() => {
    const map = {}; // { code: { descricao, codigoMicrodata, necessidadeKg, produtos: Set } }

    planningEntries.forEach((entry) => {
      const product = products.find((p) => p.id === entry.product || p.nome === entry.productName);
      if (!product) return;
      const kg = entry.planned || 0;
      if (kg === 0) return;

      // Helper to accumulate a single MP
      const accumulate = (mp, pct) => {
        if (!mp || (!mp.codigoMicrodata && !mp.descricao)) return;
        if (!pct || pct <= 0) return;
        const code = mp.codigoMicrodata || mp.descricao;
        if (!map[code]) {
          map[code] = {
            codigoMicrodata: mp.codigoMicrodata || '',
            descricao: mp.descricao || code,
            necessidadeKg: 0,
            produtos: new Set(),
          };
        }
        map[code].necessidadeKg += kg * (pct / 100);
        map[code].produtos.add(product.nome || product.id);
      };

      // Suporta formato novo: mp1, mp2, mp3 (Admin.jsx atual)
      const newFormat = ['mp1', 'mp2', 'mp3'].some((k) => product[k]?.descricao);
      if (newFormat) {
        ['mp1', 'mp2', 'mp3'].forEach((key) => {
          const mp = product[key];
          if (mp?.descricao) accumulate(mp, mp.composicaoPct);
        });
      } else {
        // Suporta formato legado: alma / efeito
        if (product.alma?.composicaoPct > 0) accumulate(product.alma, product.alma.composicaoPct);
        if (product.efeito?.composicaoPct > 0) accumulate(product.efeito, product.efeito.composicaoPct);

        // Fallback: produto sem nenhuma MP definida
        if (!product.alma && !product.efeito) {
          const code = product.id;
          if (!map[code]) {
            map[code] = { codigoMicrodata: '', descricao: product.nome || product.id, necessidadeKg: 0, produtos: new Set() };
          }
          map[code].necessidadeKg += kg;
          map[code].produtos.add(product.nome || product.id);
        }
      }
    });

    // Convert Sets to arrays and sort by highest necessity
    return Object.values(map)
      .map((m) => ({ ...m, produtos: [...m.produtos] }))
      .sort((a, b) => b.necessidadeKg - a.necessidadeKg);
  }, [planningEntries, products]);

  // Mantém ref atualizada para o auto-sync usar sempre o valor mais recente
  mpNecessidadeRef.current = mpNecessidade;

  // Summary KPIs
  const totalNecessidade = mpNecessidade.reduce((s, m) => s + m.necessidadeKg, 0);
  const totalEstoque = mpNecessidade.reduce((s, m) => s + (mpStock[m.codigoMicrodata || m.descricao]?.estoqueKg ?? 0), 0);
  const criticas = mpNecessidade.filter((m) => {
    const est = mpStock[m.codigoMicrodata || m.descricao]?.estoqueKg ?? 0;
    return m.necessidadeKg > 0 && est < m.necessidadeKg * 0.7;
  }).length;
  const totalPlannedKg = planningEntries.reduce((s, e) => s + (e.planned || 0), 0);

  // Products with at least one field (for PA cards)
  const productsWithCode = products.filter((p) => p.codigoMicrodata || p.nome);

  return (
    <div className="p-6 space-y-8 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FlaskConical size={20} className="text-brand-cyan" />
            Estoque Matéria Prima e Produto Acabado
          </h1>
          <p className="text-[10px] text-brand-muted mt-0.5 uppercase tracking-widest font-black">
            {hasRange
              ? `${dateRange.start.split('-').reverse().join('/')} → ${dateRange.end.split('-').reverse().join('/')}`
              : monthLabel}
            {' · '}{factory === 'all' ? 'Todas as Unidades' : (factory === 'matriz' ? 'Matriz' : 'Filial')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Input fallback browsers sem File System Access API */}
          <input ref={fallbackInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFallbackFile} />

          {!isSupervisor && (
            <>
              <button
                onClick={() => handleSync(mpNecessidade)}
                disabled={importing}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all shadow-sm
                  ${importing
                    ? 'bg-brand-surface border-brand-border text-brand-muted cursor-wait opacity-60'
                    : 'bg-brand-cyan/10 border-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan/20 active:scale-95 shadow-[0_0_12px_rgba(34,211,238,0.08)]'}`}
              >
                {importing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {importing ? 'Sincronizando...' : lastAutoSync ? `Sincronizado ${lastAutoSync}` : 'Sincronizar Estoque'}
              </button>
              <button
                onClick={() => clearFileHandle(CSV_HANDLE_KEY).then(() => setSyncResult(null))}
                title="Redefinir arquivo CSV de estoque"
                className="p-2 rounded-xl bg-white/5 border border-brand-border text-brand-muted hover:text-white transition-all active:scale-95"
              >
                <FolderOpen size={15} />
              </button>
            </>
          )}

          {syncResult && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-medium ${
              syncResult.error
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              <span>
                {syncResult.error
                  ? syncResult.error
                  : `${syncResult.mp} MP · ${syncResult.pa} PA · ${syncResult.skipped} ignorados`}
              </span>
              <button onClick={() => setSyncResult(null)} className="opacity-60 hover:opacity-100"><X size={12} /></button>
            </div>
          )}

          <DateRangeFilter
            dateRange={dateRange}
            setDateRange={setDateRange}
            showPicker={showPicker}
            setShowPicker={setShowPicker}
            monthLabel={monthLabel}
          />
        </div>
      </div>

      {/* ── KPI Summary ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5" style={{ borderTop: '2px solid #22d3ee' }}>
          <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-2">Produção Planejada</p>
          <p className="text-3xl font-mono font-bold text-white">{fmtKg(totalPlannedKg)}</p>
          <p className="text-xs text-brand-muted mt-1">{planningEntries.length} entradas no período</p>
        </div>
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5" style={{ borderTop: '2px solid #f97316' }}>
          <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-2">Necessidade Total MP</p>
          <p className="text-3xl font-mono font-bold text-white">{fmtKg(totalNecessidade)}</p>
          <p className="text-xs text-brand-muted mt-1">{mpNecessidade.length} tipos de MP</p>
        </div>
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5" style={{ borderTop: '2px solid #10b981' }}>
          <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-2">Estoque MP (Microdata)</p>
          <p className="text-3xl font-mono font-bold text-white">{fmtKg(totalEstoque)}</p>
          <p className="text-xs mt-1" style={{ color: totalEstoque >= totalNecessidade ? '#10b981' : '#f59e0b' }}>
            Saldo {totalEstoque >= totalNecessidade ? '+' : ''}{fmtKg(totalEstoque - totalNecessidade)}
          </p>
        </div>
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5" style={{ borderTop: '2px solid #ef4444' }}>
          <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-2">MP Críticas</p>
          <p className="text-3xl font-mono font-bold text-white">{criticas}</p>
          <p className="text-xs text-brand-muted mt-1">estoque {'<'} 70% da necessidade</p>
        </div>
      </div>

      {/* ── MP Cards ── */}
      <div>
        <h2 className="text-xs font-bold text-brand-muted uppercase tracking-widest mb-4 flex items-center gap-2">
          <FlaskConical size={16} className="text-brand-cyan" />
          Matéria-Prima — Necessidade vs Estoque Microdata
          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-md bg-brand-surface border border-brand-border">
            Clique no estoque para editar
          </span>
        </h2>

        {mpNecessidade.length === 0 ? (
          <div className="bg-brand-card border border-brand-border rounded-2xl p-12 text-center">
            <FlaskConical size={32} className="text-brand-muted mx-auto mb-3 opacity-30" />
            <p className="text-brand-muted text-sm">Nenhum planejamento encontrado para o período.</p>
            <p className="text-brand-muted text-xs mt-1">Verifique se há entradas de planejamento com produtos cadastrados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {mpNecessidade.map((mp) => {
              const stockKey = mp.codigoMicrodata || mp.descricao;
              return (
                <MpCard
                  key={stockKey}
                  mp={mp}
                  stock={mpStock[stockKey]}
                  onSaveStock={saveRawMaterialStock}
                  editable={!isSupervisor}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detalhamento por Produto ── */}
      {planningEntries.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-brand-muted uppercase tracking-widest mb-4 flex items-center gap-2">
            <Layers size={13} className="text-brand-cyan" />
            Detalhamento por Produto
          </h2>
          <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-border">
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-brand-muted uppercase tracking-widest">Produto</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold text-brand-muted uppercase tracking-widest">Planejado</th>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-brand-muted uppercase tracking-widest">MP 1</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold text-brand-muted uppercase tracking-widest">Qtd MP 1</th>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-brand-muted uppercase tracking-widest hidden md:table-cell">MP 2</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold text-brand-muted uppercase tracking-widest hidden md:table-cell">Qtd MP 2</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Aggregate by product
                    const byProduct = {};
                    planningEntries.forEach((e) => {
                      const key = e.product || e.productName || 'N/A';
                      if (!byProduct[key]) {
                        byProduct[key] = {
                          productName: e.productName || e.product || 'N/A',
                          product: e.product,
                          totalKg: 0,
                        };
                      }
                      byProduct[key].totalKg += e.planned || 0;
                    });

                    return Object.values(byProduct)
                      .sort((a, b) => b.totalKg - a.totalKg)
                      .map((row, i) => {
                        const product = products.find((p) => p.id === row.product || p.nome === row.productName);

                        // Detecta formato novo (mp1/mp2/mp3) ou legado (alma/efeito)
                        const useNewFormat = product && ['mp1', 'mp2', 'mp3'].some((k) => product[k]?.descricao);
                        const mp1 = useNewFormat ? product?.mp1 : product?.alma;
                        const mp2 = useNewFormat ? product?.mp2 : product?.efeito;

                        const mp1Desc = mp1?.descricao || '—';
                        const mp1Pct  = mp1?.composicaoPct || 0;
                        const mp2Desc = mp2?.descricao || '—';
                        const mp2Pct  = mp2?.composicaoPct || 0;

                        return (
                          <tr key={row.productName} className={`border-b border-brand-border/50 hover:bg-brand-surface/50 transition-colors ${i % 2 === 0 ? '' : 'bg-brand-surface/20'}`}>
                            <td className="px-5 py-3 text-white font-medium">{row.productName}</td>
                            <td className="px-5 py-3 text-right font-mono text-brand-cyan">{fmtKg(row.totalKg)}</td>
                            <td className="px-5 py-3 text-brand-muted text-xs">{mp1Desc}</td>
                            <td className="px-5 py-3 text-right font-mono text-white">
                              {mp1Pct > 0 ? fmtKg(row.totalKg * mp1Pct / 100) : '—'}
                              {mp1Pct > 0 && <span className="text-brand-muted text-[10px] ml-1">({mp1Pct}%)</span>}
                            </td>
                            <td className="px-5 py-3 text-brand-muted text-xs hidden md:table-cell">{mp2Desc !== '—' ? mp2Desc : '—'}</td>
                            <td className="px-5 py-3 text-right font-mono text-white hidden md:table-cell">
                              {mp2Pct > 0 ? fmtKg(row.totalKg * mp2Pct / 100) : '—'}
                              {mp2Pct > 0 && <span className="text-brand-muted text-[10px] ml-1">({mp2Pct}%)</span>}
                            </td>
                          </tr>
                        );
                      });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Estoque de Produto Acabado ── */}
      <div>
        <h2 className="text-xs font-bold text-brand-muted uppercase tracking-widest mb-4 flex items-center gap-2">
          <Package size={16} className="text-violet-400" />
          Estoque de Produto Acabado (Microdata)
          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-md bg-brand-surface border border-brand-border">
            Clique no valor para editar
          </span>
        </h2>

        {productsWithCode.length === 0 ? (
          <div className="bg-brand-card border border-brand-border rounded-2xl p-12 text-center">
            <Package size={32} className="text-brand-muted mx-auto mb-3 opacity-30" />
            <p className="text-brand-muted text-sm">Nenhum produto cadastrado ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {productsWithCode.map((product) => (
              <PaCard
                key={product.id}
                product={product}
                stock={paStock[product.id]}
                onSaveStock={saveFinishedGoodStock}
                editable={!isSupervisor}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
