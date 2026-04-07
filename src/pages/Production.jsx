import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, Download, RefreshCw, AlertTriangle, FolderOpen, X } from 'lucide-react';
import { useAppStore, useProductionStore, usePlanningStore, useAdminStore, MACHINES } from '../hooks/useStore';
import { subscribeProductionRecords, subscribePlanningEntries, saveProductionRecord } from '../services/firebase';
import { getMonthLabel, getDaysInMonth, isSunday } from '../utils/dates';
import { seedDemoData } from '../utils/seedData';
import { pickOrReuseFile, clearFileHandle, readSavedFile, parseProducaoCSV, findProductByCode } from '../utils/csvSync';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAdherenceColor(pct) {
  if (pct >= 95) return { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10' };
  if (pct >= 85) return { bar: 'bg-sky-500',     text: 'text-sky-400',     bg: 'bg-sky-500/10' };
  if (pct >= 70) return { bar: 'bg-amber-500',   text: 'text-amber-400',   bg: 'bg-amber-500/10' };
  return          { bar: 'bg-red-500',            text: 'text-red-400',     bg: 'bg-red-500/10' };
}

function getStatusBadge(pct) {
  if (pct >= 95) return { label: 'Excelente', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' };
  if (pct >= 85) return { label: 'Bom',       cls: 'bg-sky-500/15 text-sky-400 border-sky-500/20' };
  if (pct >= 70) return { label: 'Atenção',   cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20' };
  return               { label: 'Crítico',    cls: 'bg-red-500/15 text-red-400 border-red-500/20' };
}

function AdherenceIcon({ pct }) {
  if (pct >= 95) return <TrendingUp size={13} className="text-emerald-400" />;
  if (pct >= 70) return <Minus size={13} className="text-amber-400" />;
  return <TrendingDown size={13} className="text-red-400" />;
}

// ─── Row de produto ───────────────────────────────────────────────────────────

function ProductRow({ item, rank }) {
  const pct = item.planned > 0 ? Math.round((item.actual / item.planned) * 100) : 0;
  const colors = getAdherenceColor(pct);
  const badge = getStatusBadge(pct);
  const barWidth = Math.min(pct, 120); // cap visual em 120%

  return (
    <tr className="group hover:bg-white/[0.025] transition-colors border-b border-brand-border">
      {/* Rank */}
      <td className="pl-3 sm:pl-6 pr-1 sm:pr-2 py-2 sm:py-4 w-6 sm:w-8">
        <span className="text-[8px] sm:text-xs font-mono text-brand-muted/60">{rank}</span>
      </td>

      {/* Produto */}
      <td className="px-2 sm:px-4 py-2 sm:py-4 min-w-[90px] sm:min-w-fit">
        <div>
          <span className="text-xs sm:text-sm font-semibold text-white block truncate">{item.name}</span>
          {item.machine && (
            <span className="text-[8px] sm:text-[10px] text-brand-muted/60">{item.machine}</span>
          )}
        </div>
      </td>

      {/* Planejado */}
      <td className="px-2 sm:px-4 py-2 sm:py-4 text-right min-w-[60px] sm:min-w-fit">
        <span className="text-xs sm:text-sm font-mono text-white">
          {item.planned.toLocaleString('pt-BR')}
        </span>
        <span className="text-[8px] sm:text-[10px] text-brand-muted/60 ml-0.5">kg</span>
      </td>

      {/* Realizado */}
      <td className="px-2 sm:px-4 py-2 sm:py-4 text-right min-w-[60px] sm:min-w-fit">
        <span className={`text-xs sm:text-sm font-mono font-semibold ${colors.text}`}>
          {item.actual.toLocaleString('pt-BR')}
        </span>
        <span className="text-[8px] sm:text-[10px] text-brand-muted/60 ml-0.5">kg</span>
      </td>

      {/* Barra de aderência */}
      <td className="px-2 sm:px-4 py-2 sm:py-4 min-w-[70px] sm:min-w-[140px]">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-0.5">
              <AdherenceIcon pct={pct} />
              <span className={`text-[8px] sm:text-xs font-mono font-bold ${colors.text}`}>{pct}%</span>
            </div>
            <span className={`hidden sm:inline text-[7px] sm:text-[10px] font-medium px-1 sm:px-1.5 py-0.5 rounded-full border ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
          <div className="hidden sm:block h-1.5 bg-brand-surface/80 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${colors.bar}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>
      </td>

      {/* Desvio — oculto em mobile */}
      <td className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-4 text-right pr-3 sm:pr-6">
        {item.planned > 0 && (
          <span className={`text-[8px] sm:text-xs font-mono ${item.actual >= item.planned ? 'text-emerald-400' : 'text-red-400'}`}>
            {item.actual >= item.planned ? '+' : ''}
            {(item.actual - item.planned).toLocaleString('pt-BR')} kg
          </span>
        )}
      </td>
    </tr>
  );
}

// ─── Production Page ──────────────────────────────────────────────────────────

const CSV_HANDLE_KEY = 'producao-csv';

export default function Production() {
  const { factory, month, changeMonth, getYearMonth } = useAppStore();
  const { records, setRecords, setLoading } = useProductionStore();
  const { entriesMap, setEntriesFromArray } = usePlanningStore();
  const entries = Object.values(entriesMap);
  const { products } = useAdminStore();

  const [viewMode, setViewMode] = useState('product'); // 'product' | 'machine' | 'daily'
  const [sortBy, setSortBy] = useState('planned'); // 'planned' | 'actual' | 'pct' | 'name'
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'critical' | 'attention' | 'good'
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null); // { imported, skipped, noProduct }
  const [lastAutoSync, setLastAutoSync] = useState(null);
  const fallbackInputRef = useRef(null);

  const AUTO_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutos

  // ─── CSV Sync ───────────────────────────────────────────────────────────────

  const processCSVText = async (text) => {
    const rows = parseProducaoCSV(text);
    if (rows.length === 0) {
      setSyncResult({ imported: 0, skipped: 0, noProduct: 0, error: 'Arquivo vazio ou formato não reconhecido.' });
      return;
    }

    // Determina a fábrica — se 'all', usa a primeira fábrica dos dados (ou 'matriz')
    const targetFactory = factory === 'all' ? 'matriz' : factory;
    const yearMonth = getYearMonth();

    // 1. Filtra e resolve produtos
    let skipped = 0, noProduct = 0;
    const validRows = [];
    for (const row of rows) {
      if (!row.date.startsWith(yearMonth)) { skipped++; continue; }
      const product = findProductByCode(products, row.productCode);
      if (!product) { noProduct++; continue; }
      validRows.push({ row, product });
    }

    // 2. Agrega por produto+data (soma todas as linhas do CSV para o mesmo produto/dia)
    // Não inclui máquina na chave pois o CSV pode ter várias linhas por máquina/bobina
    const aggMap = {};
    for (const { row, product } of validRows) {
      const key = `${product.id}__${row.date}`;
      if (!aggMap[key]) {
        aggMap[key] = {
          factory:     targetFactory,
          machine:     row.machine || 'CSV',
          machineName: row.machine || 'CSV',
          product:     product.id,
          productName: product.nome || product.productName || product.id,
          date:        row.date,
          actual:      0,
          planned:     0,
        };
      }
      aggMap[key].actual += row.quantity;
    }

    // 3. Salva no Firestore (um doc por produto+dia)
    const toSave = Object.values(aggMap);
    for (const record of toSave) {
      await saveProductionRecord(record);
    }

    setSyncResult({ imported: toSave.length, skipped, noProduct });
    setSyncing(false);
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncResult(null);

    // Tenta File System Access API; se não suportado, usa input[type=file]
    if (window.showOpenFilePicker) {
      try {
        const file = await pickOrReuseFile(CSV_HANDLE_KEY);
        if (!file) { setSyncing(false); return; }
        const text = await file.text();
        await processCSVText(text);
      } catch (err) {
        setSyncResult({ error: err.message });
        setSyncing(false);
      }
    } else {
      fallbackInputRef.current?.click();
    }
  };

  const handleFallbackFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) { setSyncing(false); return; }
    try {
      const text = await file.text();
      await processCSVText(text);
    } catch (err) {
      setSyncResult({ error: err.message });
      setSyncing(false);
    }
    e.target.value = '';
  };

  const handleResetFile = async () => {
    await clearFileHandle(CSV_HANDLE_KEY);
    setSyncResult(null);
  };

  // ────────────────────────────────────────────────────────────────────────────

  const machines = factory === 'all'
    ? [...MACHINES.matriz, ...MACHINES.filial]
    : MACHINES[factory] || [];
  const yearMonth = getYearMonth();
  const monthLabel = getMonthLabel(month.year, month.month);

  // Subscribe a produção realizada do Firebase
  useEffect(() => {
    setLoading(true);
    const unsub = subscribeProductionRecords(factory, yearMonth, (data) => {
      if (data.length === 0) {
        const { production: demo } = seedDemoData();
        const factoryDemo = demo.filter(
          (r) => (factory === 'all' || r.factory === factory) && r.date.startsWith(yearMonth)
        );
        setRecords(factoryDemo);
      } else {
        setRecords(data);
      }
    });
    return () => unsub();
  }, [factory, yearMonth]);

  // Subscribe ao planejamento (para calcular aderência por produto)
  useEffect(() => {
    const unsub = subscribePlanningEntries(factory, yearMonth, (data) => {
      setEntriesFromArray(data);
    });
    return () => unsub();
  }, [factory, yearMonth]);

  // ─── Auto-sync (lê arquivo salvo sem interação, a cada 5 min) ───────────────
  useEffect(() => {
    const autoSync = async () => {
      if (syncing) return;
      const file = await readSavedFile(CSV_HANDLE_KEY);
      if (!file) return; // nenhum arquivo salvo — aguarda sync manual
      try {
        const text = await file.text();
        await processCSVText(text);
        setLastAutoSync(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      } catch { /* falha silenciosa no auto-sync */ }
    };

    autoSync(); // executa imediatamente ao montar/trocar fábrica ou mês
    const interval = setInterval(autoSync, AUTO_SYNC_INTERVAL);
    return () => clearInterval(interval);
  }, [factory, yearMonth]);

  // ─── Agregações ────────────────────────────────────────────────────────

  // Limita o planejado até a data atual — compara planejado vs realizado no mesmo período
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  // yearMonth já usa month+1 (getYearMonth), portanto a comparação fica correta
  const isCurrentMonth = yearMonth === today.slice(0, 7);

  /**
   * Resolve a data de uma entry de planejamento.
   * Quando `e.date` é convertido com sucesso pelo Firestore (Timestamp → string) retorna
   * a string "YYYY-MM-DD". Se a data foi salva como string pura, a conversão falha e
   * `e.date` fica undefined — nesse caso usamos o ID do documento como fallback,
   * pois o ID segue o formato `factory__machine__YYYY-MM-DD`.
   */
  const resolveEntryDate = (e) => e.date || e.id?.split('__')[2] || null;

  // Por produto — planejado vem de entries, realizado vem de records (CSV)
  // A ligação é feita pelo código do produto (r.product / e.product)
  const byProduct = (() => {
    const map = {};

    // 1. Planejado: soma das planning entries até hoje (não conta dias futuros)
    entries.forEach((e) => {
      if (e.cellType !== 'producao' && e.cellType) return;
      const entryDate = resolveEntryDate(e);
      // Exclui entries cujo mês não bate com o mês sendo visualizado
      if (entryDate && !entryDate.startsWith(yearMonth)) return;
      if (isCurrentMonth && entryDate && entryDate > yesterday) return;
      const key = e.product;
      if (!key) return;
      if (!map[key]) map[key] = { name: e.productName || e.product, planned: 0, actual: 0 };
      map[key].planned += e.planned || 0;
    });

    // 2. Realizado: soma dos production records (importados via CSV)
    // Quando fábrica específica: só conta realizados de produtos que têm planejamento
    // nesta fábrica, evitando contaminação cruzada (CSV contém produção de todas as unidades)
    records.forEach((r) => {
      const key = r.product;
      if (!key) return;
      if (factory !== 'all' && !map[key]) return; // ignora produtos sem planejamento nesta fábrica
      if (!map[key]) map[key] = { name: r.productName || r.product, planned: 0, actual: 0 };
      map[key].actual += r.actual || 0;
    });

    return Object.values(map).map((item) => ({
      ...item,
      pct: item.planned > 0 ? Math.round((item.actual / item.planned) * 100) : 0,
    }));
  })();

  // Por máquina — planejado vem de entries, realizado vem de records (CSV)
  const byMachine = (() => {
    const map = {};
    machines.forEach((m) => {
      map[m.id] = { name: m.id, label: m.name, planned: 0, actual: 0 };
    });
    entries.forEach((e) => {
      if (e.cellType !== 'producao' && e.cellType) return;
      const entryDate = resolveEntryDate(e);
      if (entryDate && !entryDate.startsWith(yearMonth)) return;
      if (isCurrentMonth && entryDate && entryDate > yesterday) return;
      if (map[e.machine]) map[e.machine].planned += e.planned || 0;
    });
    records.forEach((r) => {
      if (map[r.machine]) map[r.machine].actual += r.actual || 0;
    });
    return Object.values(map).map((item) => ({
      ...item,
      pct: item.planned > 0 ? Math.round((item.actual / item.planned) * 100) : 0,
    }));
  })();

  // Por dia (últimos 15 dias com dados)
  const byDay = (() => {
    const map = {};
    records.forEach((r) => {
      const date = typeof r.date === 'string' ? r.date : r.date?.toISOString?.()?.split('T')[0];
      if (!date) return;
      if (!map[date]) map[date] = { name: date, planned: 0, actual: 0 };
      map[date].actual += r.actual || 0;
      map[date].planned += r.planned || 0;
    });
    return Object.values(map)
      .map((item) => ({ ...item, pct: item.planned > 0 ? Math.round((item.actual / item.planned) * 100) : 0 }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(-20);
  })();

  // Dataset ativo
  const activeData = viewMode === 'product' ? byProduct : viewMode === 'machine' ? byMachine : byDay;

  // Filtrar
  const filteredData = activeData.filter((item) => {
    if (filterStatus === 'critical') return item.pct < 70;
    if (filterStatus === 'attention') return item.pct >= 70 && item.pct < 85;
    if (filterStatus === 'good') return item.pct >= 85;
    return true;
  });

  // Ordenar
  const sortedData = [...filteredData].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'pct') return b.pct - a.pct;
    if (sortBy === 'actual') return b.actual - a.actual;
    return b.planned - a.planned; // default
  });

  // KPIs globais — derivados do byProduct já consolidado
  const totalPlanned = byProduct.reduce((s, p) => s + p.planned, 0);
  const totalActual  = byProduct.reduce((s, p) => s + p.actual, 0);
  const globalPct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;
  const globalColors = getAdherenceColor(globalPct);

  const criticalCount = activeData.filter((i) => i.pct < 70).length;
  const attentionCount = activeData.filter((i) => i.pct >= 70 && i.pct < 85).length;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-x-hidden">

      {/* ─── Toast de resultado do sync ──────────────────────────────── */}
      {syncResult && (
        <div className={`mx-6 mt-3 flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-medium shrink-0 ${
          syncResult.error
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        }`}>
          <span>
            {syncResult.error
              ? `Erro: ${syncResult.error}`
              : `${syncResult.imported} registros importados · ${syncResult.noProduct} produto(s) não encontrado(s) no PWA · ${syncResult.skipped} fora do mês`}
          </span>
          <button onClick={() => setSyncResult(null)} className="ml-4 text-current opacity-60 hover:opacity-100">
            <X size={13} />
          </button>
        </div>
      )}

      {/* ─── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-brand-border shrink-0 gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 tracking-tight">
            <TrendingUp size={18} className="text-brand-cyan shrink-0" />
            Produção Realizada
          </h1>
          <p className="text-[10px] text-brand-muted mt-0.5 uppercase tracking-widest font-black">
            {monthLabel} · {factory === 'all' ? 'Todas as Unidades' : (factory === 'matriz' ? 'Matriz' : 'Filial')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Navegação de mês */}
          <div className="flex items-center gap-1 bg-brand-surface/50 rounded-xl p-1 border border-brand-border">
            <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-white/[0.06] rounded-xl transition-colors text-brand-muted hover:text-white">
              <ChevronLeft size={15} />
            </button>
            <span className="text-xs font-bold text-white px-2 min-w-[90px] text-center capitalize">
              {new Date(month.year, month.month).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
            </span>
            <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-white/[0.06] rounded-xl transition-colors text-brand-muted hover:text-white">
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Input fallback para browsers sem File System Access API */}
          <input ref={fallbackInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFallbackFile} />

          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/20 text-brand-cyan text-xs font-bold rounded-xl transition-all disabled:opacity-50 active:scale-95"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : lastAutoSync ? `Sincronizado ${lastAutoSync}` : 'Sincronizar'}
          </button>

          <button
            onClick={handleResetFile}
            title="Redefinir arquivo CSV configurado"
            className="p-2 rounded-xl bg-white/5 border border-brand-border text-brand-muted hover:text-white transition-all active:scale-95"
          >
            <FolderOpen size={15} />
          </button>
        </div>
      </div>

      {/* ─── KPI Cards ─────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 grid grid-cols-2 lg:grid-cols-4 gap-3 border-b border-brand-border shrink-0">
        {/* Aderência global */}
        <div className={`rounded-xl p-3.5 border ${globalColors.bg} border-brand-border`}>
          <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-1">Aderência Geral</p>
          <div className="flex items-end gap-1">
            <span className={`text-2xl font-mono font-bold ${globalColors.text}`}>{globalPct}%</span>
          </div>
          <div className="mt-2 h-1 bg-brand-bg/40 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${globalColors.bar}`} style={{ width: `${Math.min(globalPct, 100)}%` }} />
          </div>
        </div>

        {/* Total realizado */}
        <div className="rounded-xl p-3.5 border border-brand-border bg-white/[0.02]">
          <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-1">Total Realizado</p>
          <p className="text-2xl font-mono font-bold text-white">
            {totalActual >= 1000000
              ? `${(totalActual / 1000000).toFixed(1)}M`
              : totalActual >= 1000
              ? `${(totalActual / 1000).toFixed(0)}k`
              : totalActual.toLocaleString('pt-BR')}
            <span className="text-xs font-normal text-brand-muted ml-1">kg</span>
          </p>
          <p className="text-[10px] text-brand-muted/60 mt-1">
            de {totalPlanned.toLocaleString('pt-BR')} kg planejados até ontem
          </p>
        </div>

        {/* Críticos */}
        <div className={`rounded-xl p-3.5 border ${criticalCount > 0 ? 'border-red-500/20 bg-red-500/[0.05]' : 'border-brand-border bg-white/[0.02]'}`}>
          <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-1">Críticos</p>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && <AlertTriangle size={14} className="text-red-400" />}
            <span className={`text-2xl font-mono font-bold ${criticalCount > 0 ? 'text-red-400' : 'text-brand-muted'}`}>
              {criticalCount}
            </span>
          </div>
          <p className="text-[10px] text-brand-muted/60 mt-1">abaixo de 70%</p>
        </div>

        {/* Atenção */}
        <div className={`rounded-xl p-3.5 border ${attentionCount > 0 ? 'border-amber-500/20 bg-amber-500/[0.05]' : 'border-brand-border bg-white/[0.02]'}`}>
          <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-1">Atenção</p>
          <span className={`text-2xl font-mono font-bold ${attentionCount > 0 ? 'text-amber-400' : 'text-brand-muted'}`}>
            {attentionCount}
          </span>
          <p className="text-[10px] text-brand-muted/60 mt-1">entre 70% e 85%</p>
        </div>
      </div>

      {/* ─── Toolbar ───────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-3 flex items-center gap-2 sm:gap-3 border-b border-brand-border shrink-0 flex-wrap">
        {/* View mode */}
        <div className="flex gap-1 bg-brand-surface/40 rounded-xl p-1 border border-brand-border">
          {[
            { id: 'product', label: 'Por Produto' },
            { id: 'machine', label: 'Por Máquina' },
            { id: 'daily',   label: 'Por Dia' },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                viewMode === v.id
                  ? 'bg-brand-surface text-white shadow-sm'
                  : 'text-brand-muted hover:text-white'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Filtro de status */}
        <div className="flex gap-1">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'critical', label: 'Crítico' },
            { id: 'attention', label: 'Atenção' },
            { id: 'good', label: 'Bom' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterStatus(f.id)}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-all border ${
                filterStatus === f.id
                  ? 'bg-brand-cyan/20 border-brand-cyan/40 text-sky-300'
                  : 'border-transparent text-brand-muted hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Ordenação */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-brand-surface/40 border border-brand-border rounded-xl px-3 py-1.5 text-xs text-brand-muted focus:outline-none focus:border-brand-cyan/40 transition-all"
          >
            <option value="planned">Ordenar: Planejado</option>
            <option value="actual">Ordenar: Realizado</option>
            <option value="pct">Ordenar: Aderência</option>
            <option value="name">Ordenar: Nome</option>
          </select>
        </div>
      </div>

      {/* ─── Tabela ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto w-full">
        {sortedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-12 h-12 rounded-full bg-brand-surface/40 flex items-center justify-center mb-3">
              <TrendingUp size={20} className="text-brand-muted/60" />
            </div>
            <p className="text-sm text-brand-muted">Nenhum registro de produção encontrado</p>
            <p className="text-xs text-brand-muted/60 mt-1">Sincronize com o Microdata ou aguarde dados do agente</p>
          </div>
        ) : (
          <table className="w-full border-collapse min-w-full">
            <thead>
              <tr className="sticky top-0 z-10 bg-brand-bg/95 backdrop-blur-sm border-b border-brand-border">
                <th className="pl-3 sm:pl-6 pr-2 py-3 text-left w-6 sm:w-8">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-brand-muted uppercase tracking-wider">#</span>
                </th>
                <th className="px-2 sm:px-4 py-3 text-left min-w-[90px] sm:min-w-fit">
                  <button onClick={() => setSortBy('name')} className="text-[9px] sm:text-[10px] font-semibold text-brand-muted uppercase tracking-wider hover:text-white transition-colors">
                    {viewMode === 'product' ? 'Produto' : viewMode === 'machine' ? 'Máquina' : 'Data'}
                  </button>
                </th>
                <th className="px-2 sm:px-4 py-3 text-right min-w-[60px] sm:min-w-fit">
                  <button onClick={() => setSortBy('planned')} className="text-[9px] sm:text-[10px] font-semibold text-brand-muted uppercase tracking-wider hover:text-white transition-colors">
                    Planejado
                  </button>
                </th>
                <th className="px-2 sm:px-4 py-3 text-right min-w-[60px] sm:min-w-fit">
                  <button onClick={() => setSortBy('actual')} className="text-[9px] sm:text-[10px] font-semibold text-brand-muted uppercase tracking-wider hover:text-white transition-colors">
                    Realizado
                  </button>
                </th>
                <th className="px-2 sm:px-4 py-3 min-w-[70px] sm:min-w-[180px]">
                  <button onClick={() => setSortBy('pct')} className="text-[9px] sm:text-[10px] font-semibold text-brand-muted uppercase tracking-wider hover:text-white transition-colors">
                    Aderência
                  </button>
                </th>
                <th className="hidden sm:table-cell px-2 sm:px-4 py-3 text-right pr-3 sm:pr-6 min-w-[70px] sm:min-w-fit">
                  <span className="text-[9px] sm:text-[10px] font-semibold text-brand-muted uppercase tracking-wider">Desvio</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((item, i) => (
                <ProductRow key={item.name} item={item} rank={i + 1} />
              ))}
            </tbody>

            {/* Footer de totais */}
            <tfoot>
              <tr className="border-t-2 border-white/[0.08] bg-brand-card/60">
                <td colSpan={2} className="pl-3 sm:pl-6 py-3 sm:py-4">
                  <span className="text-[9px] sm:text-xs font-bold text-brand-muted uppercase tracking-wider">
                    Total — {sortedData.length} {viewMode === 'product' ? 'produtos' : viewMode === 'machine' ? 'máquinas' : 'dias'}
                  </span>
                </td>
                <td className="px-2 sm:px-4 py-3 sm:py-4 text-right">
                  <span className="text-xs sm:text-sm font-mono font-bold text-white">
                    {sortedData.reduce((s, i) => s + i.planned, 0).toLocaleString('pt-BR')}
                    <span className="text-[8px] sm:text-xs font-normal text-brand-muted ml-1">kg</span>
                  </span>
                </td>
                <td className="px-2 sm:px-4 py-3 sm:py-4 text-right">
                  <span className={`text-xs sm:text-sm font-mono font-bold ${globalColors.text}`}>
                    {sortedData.reduce((s, i) => s + i.actual, 0).toLocaleString('pt-BR')}
                    <span className="text-[8px] sm:text-xs font-normal text-brand-muted ml-1">kg</span>
                  </span>
                </td>
                <td className="px-2 sm:px-4 py-3 sm:py-4">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <AdherenceIcon pct={globalPct} />
                    <span className={`text-xs sm:text-sm font-mono font-bold ${globalColors.text}`}>{globalPct}%</span>
                    <span className={`text-[8px] sm:text-[10px] font-medium px-1.5 sm:px-2 py-0.5 rounded-full border ${getStatusBadge(globalPct).cls}`}>
                      {getStatusBadge(globalPct).label}
                    </span>
                  </div>
                </td>
                <td className="hidden sm:table-cell px-2 sm:px-4 py-3 sm:py-4 text-right pr-3 sm:pr-6">
                  {(() => {
                    const totalDev = sortedData.reduce((s, i) => s + i.actual - i.planned, 0);
                    return (
                      <span className={`text-[8px] sm:text-xs font-mono font-bold ${totalDev >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {totalDev >= 0 ? '+' : ''}{totalDev.toLocaleString('pt-BR')} kg
                      </span>
                    );
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
