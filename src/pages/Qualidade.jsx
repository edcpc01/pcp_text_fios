import { useState, useEffect, useRef } from 'react';
import { Award, ChevronLeft, ChevronRight, RefreshCw, FolderOpen, X, Building2, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../hooks/useStore';
import { getMonthLabel } from '../utils/dates';
import { pickOrReuseFile, clearFileHandle, readSavedFile, parseQualidadeCSV } from '../utils/csvSync';

const SEGUNDA = new Set(['A3', 'DV']);
const REFUGO  = new Set(['AS', 'EJ', 'EI', 'EM', 'EP']);
const CSV_KEY = 'producao-csv';

function tier(classif) {
  const c = (classif || '').toUpperCase().trim();
  if (SEGUNDA.has(c)) return 'segunda';
  if (REFUGO.has(c))  return 'refugo';
  return 'primeira';
}

function resolveFactory(emp) {
  const cod = String(emp || '').replace(/^0+/, '');
  if (cod === '9') return 'matriz';
  if (cod === '7') return 'filial';
  return 'outra';
}

function fmtKg(v) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}t`;
  return v.toLocaleString('pt-BR');
}

function pctOf(part, total) {
  return total > 0 ? ((part / total) * 100).toFixed(1) : '0.0';
}

export default function Qualidade() {
  const { factory, month, changeMonth, getYearMonth } = useAppStore();
  const [allRows, setAllRows]       = useState([]);
  const [syncing, setSyncing]       = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [lastSync, setLastSync]     = useState(null);
  const [sortBy, setSortBy]         = useState('total');
  const fallbackRef = useRef(null);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const yearMonth  = getYearMonth();
  const monthLabel = getMonthLabel(month.year, month.month);

  const processText = (text) => {
    const rows = parseQualidadeCSV(text);
    if (!rows.length) {
      setSyncResult({ error: 'Arquivo vazio ou formato não reconhecido.' });
      setSyncing(false);
      return;
    }
    setAllRows(rows);
    setSyncResult({ imported: rows.length });
    setSyncing(false);
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncResult(null);
    if (!window.showOpenFilePicker || isMobile) { fallbackRef.current?.click(); return; }
    try {
      const file = await pickOrReuseFile(CSV_KEY);
      if (!file) { setSyncing(false); return; }
      processText(await file.text());
    } catch (err) {
      setSyncResult({ error: err.message });
      setSyncing(false);
    }
  };

  const handleFallback = async (e) => {
    const file = e.target.files?.[0];
    if (!file) { setSyncing(false); return; }
    try { processText(await file.text()); } catch (err) { setSyncResult({ error: err.message }); setSyncing(false); }
    e.target.value = '';
  };

  useEffect(() => {
    const autoSync = async () => {
      const file = await readSavedFile(CSV_KEY);
      if (!file) return;
      try {
        const rows = parseQualidadeCSV(await file.text());
        if (rows.length) {
          setAllRows(rows);
          setLastSync(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        }
      } catch { /* silencioso */ }
    };
    autoSync();
    const id = setInterval(autoSync, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Filtragem por mês e fábrica
  const filtered = allRows.filter((r) => {
    if (!r.date.startsWith(yearMonth)) return false;
    if (factory !== 'all' && resolveFactory(r.empresa) !== factory) return false;
    return true;
  });

  // Agregação por produto + fábrica
  const aggMap = {};
  for (const r of filtered) {
    const f   = resolveFactory(r.empresa);
    const key = `${r.productCode}__${f}`;
    if (!aggMap[key]) aggMap[key] = { code: r.productCode, name: r.productName || r.productCode, factory: f, primeira: 0, segunda: 0, refugo: 0, total: 0 };
    aggMap[key][tier(r.classif)] += r.quantity;
    aggMap[key].total             += r.quantity;
  }

  const rows = Object.values(aggMap).sort((a, b) => {
    if (sortBy === 'name')     return a.name.localeCompare(b.name);
    if (sortBy === 'primeira') return b.primeira - a.primeira;
    if (sortBy === 'segunda')  return b.segunda  - a.segunda;
    if (sortBy === 'refugo')   return b.refugo   - a.refugo;
    return b.total - a.total;
  });

  const totalKg    = filtered.reduce((s, r) => s + r.quantity, 0);
  const primeiraKg = filtered.filter((r) => tier(r.classif) === 'primeira').reduce((s, r) => s + r.quantity, 0);
  const segundaKg  = filtered.filter((r) => tier(r.classif) === 'segunda').reduce((s, r)  => s + r.quantity, 0);
  const refugoKg   = filtered.filter((r) => tier(r.classif) === 'refugo').reduce((s, r)   => s + r.quantity, 0);

  const factoryLabel = factory === 'all' ? 'Todas as Unidades' : factory === 'matriz' ? 'Corradi Matriz' : 'Corradi Filial';

  return (
    <div className="flex flex-col h-full min-h-0 overflow-x-hidden">

      {/* Toast */}
      {syncResult && (
        <div className={`mx-6 mt-3 flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-medium shrink-0
          ${syncResult.error ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
          <span>{syncResult.error ? `Erro: ${syncResult.error}` : `${syncResult.imported} linhas lidas do CSV`}</span>
          <button onClick={() => setSyncResult(null)} className="ml-4 opacity-60 hover:opacity-100"><X size={13} /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-brand-border shrink-0 gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 tracking-tight">
            <Award size={18} className="text-brand-cyan shrink-0" />
            Qualidade
          </h1>
          <p className="text-[10px] text-brand-muted mt-0.5 uppercase tracking-widest font-black">
            {monthLabel} · {factoryLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-brand-surface/50 rounded-xl p-1 border border-brand-border">
            <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-white/[0.06] rounded-xl transition-colors text-brand-muted hover:text-white"><ChevronLeft size={15} /></button>
            <span className="text-xs font-bold text-white px-2 min-w-[90px] text-center capitalize">
              {new Date(month.year, month.month).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
            </span>
            <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-white/[0.06] rounded-xl transition-colors text-brand-muted hover:text-white"><ChevronRight size={15} /></button>
          </div>
          <input ref={fallbackRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFallback} />
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/20 text-brand-cyan text-xs font-bold rounded-xl transition-all disabled:opacity-50 active:scale-95">
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : lastSync ? `Sincronizado ${lastSync}` : 'Sincronizar CSV'}
          </button>
          <button onClick={async () => { await clearFileHandle(CSV_KEY); setSyncResult(null); setAllRows([]); }}
            title="Redefinir arquivo CSV"
            className="p-2 rounded-xl bg-white/5 border border-brand-border text-brand-muted hover:text-white transition-all active:scale-95">
            <FolderOpen size={15} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 grid grid-cols-2 lg:grid-cols-4 gap-3 border-b border-brand-border shrink-0">
        <div className="rounded-xl p-3.5 border border-brand-border bg-white/[0.02]">
          <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-1">Total Produzido</p>
          <p className="text-2xl font-mono font-bold text-white">{fmtKg(totalKg)}<span className="text-xs font-normal text-brand-muted ml-1">kg</span></p>
          <p className="text-[10px] text-brand-muted/60 mt-1">{monthLabel}</p>
        </div>

        <div className="rounded-xl p-3.5 border border-emerald-500/20 bg-emerald-500/[0.05]">
          <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-1">1ª Qualidade</p>
          <p className="text-2xl font-mono font-bold text-emerald-400">{fmtKg(primeiraKg)}<span className="text-xs font-normal text-brand-muted ml-1">kg</span></p>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex-1 h-1 bg-brand-bg/40 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pctOf(primeiraKg, totalKg)}%` }} />
            </div>
            <span className="text-[10px] font-mono text-emerald-400">{pctOf(primeiraKg, totalKg)}%</span>
          </div>
        </div>

        <div className="rounded-xl p-3.5 border border-amber-500/20 bg-amber-500/[0.05]">
          <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-1">2ª Qualidade</p>
          <p className="text-2xl font-mono font-bold text-amber-400">{fmtKg(segundaKg)}<span className="text-xs font-normal text-brand-muted ml-1">kg</span></p>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex-1 h-1 bg-brand-bg/40 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pctOf(segundaKg, totalKg)}%` }} />
            </div>
            <span className="text-[10px] font-mono text-amber-400">{pctOf(segundaKg, totalKg)}%</span>
          </div>
          <p className="text-[9px] text-brand-muted/50 mt-1">Classif: A3, DV</p>
        </div>

        <div className={`rounded-xl p-3.5 border ${refugoKg > 0 ? 'border-red-500/20 bg-red-500/[0.05]' : 'border-brand-border bg-white/[0.02]'}`}>
          <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-1">Refugo / Sucata</p>
          <div className="flex items-center gap-2">
            {refugoKg > 0 && <AlertTriangle size={14} className="text-red-400" />}
            <p className={`text-2xl font-mono font-bold ${refugoKg > 0 ? 'text-red-400' : 'text-brand-muted'}`}>{fmtKg(refugoKg)}<span className="text-xs font-normal text-brand-muted ml-1">kg</span></p>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex-1 h-1 bg-brand-bg/40 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full" style={{ width: `${pctOf(refugoKg, totalKg)}%` }} />
            </div>
            <span className="text-[10px] font-mono text-red-400">{pctOf(refugoKg, totalKg)}%</span>
          </div>
          <p className="text-[9px] text-brand-muted/50 mt-1">Classif: AS, EJ, EI, EM, EP</p>
        </div>
      </div>

      {/* Toolbar ordenação */}
      <div className="px-4 sm:px-6 py-3 flex items-center gap-2 border-b border-brand-border shrink-0 flex-wrap">
        <span className="text-[10px] text-brand-muted uppercase tracking-wider">Ordenar:</span>
        {[
          { id: 'total',    label: 'Total' },
          { id: 'primeira', label: '1ª Qual.' },
          { id: 'segunda',  label: '2ª Qual.' },
          { id: 'refugo',   label: 'Refugo' },
          { id: 'name',     label: 'Produto' },
        ].map((s) => (
          <button key={s.id} onClick={() => setSortBy(s.id)}
            className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-all border
              ${sortBy === s.id ? 'bg-brand-cyan/20 border-brand-cyan/40 text-sky-300' : 'border-transparent text-brand-muted hover:text-white'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto w-full">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-12 h-12 rounded-full bg-brand-surface/40 flex items-center justify-center mb-3">
              <Award size={20} className="text-brand-muted/60" />
            </div>
            <p className="text-sm text-brand-muted">Nenhum dado de qualidade encontrado</p>
            <p className="text-xs text-brand-muted/60 mt-1">Sincronize o CSV da Produção Realizada para carregar os dados</p>
          </div>
        ) : (<>

          {/* Mobile: Cards */}
          <div className="sm:hidden divide-y divide-brand-border/40">
            {rows.map((item) => {
              const factLbl = item.factory === 'matriz' ? 'Corradi Matriz' : item.factory === 'filial' ? 'Corradi Filial' : item.factory;
              return (
                <div key={`${item.code}__${item.factory}`} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Building2 size={10} className="text-brand-muted/60" />
                        <span className="text-[10px] text-brand-muted/70">{factLbl}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-mono font-bold text-white">{item.total.toLocaleString('pt-BR')}</p>
                      <p className="text-[9px] text-brand-muted">kg total</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-emerald-500/10 rounded-lg p-2">
                      <p className="text-[9px] text-emerald-400/80 uppercase">1ª Qual.</p>
                      <p className="text-xs font-mono font-bold text-emerald-400">{item.primeira.toLocaleString('pt-BR')}</p>
                      <p className="text-[9px] text-emerald-400/60">{pctOf(item.primeira, item.total)}%</p>
                    </div>
                    <div className="bg-amber-500/10 rounded-lg p-2">
                      <p className="text-[9px] text-amber-400/80 uppercase">2ª Qual.</p>
                      <p className="text-xs font-mono font-bold text-amber-400">{item.segunda.toLocaleString('pt-BR')}</p>
                      <p className="text-[9px] text-amber-400/60">{pctOf(item.segunda, item.total)}%</p>
                    </div>
                    <div className={`${item.refugo > 0 ? 'bg-red-500/10' : 'bg-white/[0.02]'} rounded-lg p-2`}>
                      <p className={`text-[9px] uppercase ${item.refugo > 0 ? 'text-red-400/80' : 'text-brand-muted/60'}`}>Refugo</p>
                      <p className={`text-xs font-mono font-bold ${item.refugo > 0 ? 'text-red-400' : 'text-brand-muted'}`}>{item.refugo.toLocaleString('pt-BR')}</p>
                      <p className={`text-[9px] ${item.refugo > 0 ? 'text-red-400/60' : 'text-brand-muted/40'}`}>{pctOf(item.refugo, item.total)}%</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="px-4 py-3.5 border-t-2 border-white/[0.08] bg-brand-card/60">
              <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider mb-2">Total — {rows.length} produto{rows.length !== 1 ? 's' : ''}</p>
              <div className="grid grid-cols-3 gap-2">
                <div><p className="text-[9px] text-brand-muted uppercase">1ª Qual.</p><p className="text-sm font-mono font-bold text-emerald-400">{fmtKg(primeiraKg)} <span className="text-[9px] text-brand-muted">kg</span></p></div>
                <div><p className="text-[9px] text-brand-muted uppercase">2ª Qual.</p><p className="text-sm font-mono font-bold text-amber-400">{fmtKg(segundaKg)} <span className="text-[9px] text-brand-muted">kg</span></p></div>
                <div><p className="text-[9px] text-brand-muted uppercase">Refugo</p><p className={`text-sm font-mono font-bold ${refugoKg > 0 ? 'text-red-400' : 'text-brand-muted'}`}>{fmtKg(refugoKg)} <span className="text-[9px] text-brand-muted">kg</span></p></div>
              </div>
            </div>
          </div>

          {/* Desktop: Tabela */}
          <table className="hidden sm:table w-full border-collapse min-w-full">
            <thead>
              <tr className="sticky top-0 z-10 bg-brand-bg/95 backdrop-blur-sm border-b border-brand-border">
                <th className="pl-6 pr-4 py-3 text-left"><button onClick={() => setSortBy('name')} className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider hover:text-white transition-colors">Produto</button></th>
                <th className="px-4 py-3 text-left"><span className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider">Empresa</span></th>
                <th className="px-4 py-3 text-right"><button onClick={() => setSortBy('primeira')} className="text-[10px] font-semibold text-emerald-400/80 uppercase tracking-wider hover:text-emerald-400 transition-colors">1ª Qualidade</button></th>
                <th className="px-4 py-3 text-right"><button onClick={() => setSortBy('segunda')} className="text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider hover:text-amber-400 transition-colors">2ª Qualidade</button></th>
                <th className="px-4 py-3 text-right"><button onClick={() => setSortBy('refugo')} className="text-[10px] font-semibold text-red-400/80 uppercase tracking-wider hover:text-red-400 transition-colors">Refugo / Sucata</button></th>
                <th className="px-4 py-3 pr-6 text-right"><button onClick={() => setSortBy('total')} className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider hover:text-white transition-colors">Total</button></th>
                <th className="px-4 py-3 pr-6 text-left"><span className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider">1ª %</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const pct1 = item.total > 0 ? (item.primeira / item.total) * 100 : 0;
                const factLbl   = item.factory === 'matriz' ? 'Corradi Matriz' : item.factory === 'filial' ? 'Corradi Filial' : item.factory;
                const factColor = item.factory === 'matriz' ? 'text-sky-400' : item.factory === 'filial' ? 'text-violet-400' : 'text-brand-muted';
                return (
                  <tr key={`${item.code}__${item.factory}`} className="hover:bg-white/[0.025] transition-colors border-b border-brand-border">
                    <td className="pl-6 pr-4 py-3">
                      <span className="text-sm font-semibold text-white">{item.name}</span>
                      <span className="block text-[10px] text-brand-muted/60">{item.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${factColor}`}>{factLbl}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-mono font-bold text-emerald-400">{item.primeira.toLocaleString('pt-BR')}</span>
                      <span className="text-[10px] text-brand-muted/60 ml-1">kg</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.segunda > 0
                        ? <><span className="text-sm font-mono font-bold text-amber-400">{item.segunda.toLocaleString('pt-BR')}</span><span className="text-[10px] text-brand-muted/60 ml-1">kg</span></>
                        : <span className="text-xs text-brand-muted/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.refugo > 0
                        ? <><span className="text-sm font-mono font-bold text-red-400">{item.refugo.toLocaleString('pt-BR')}</span><span className="text-[10px] text-brand-muted/60 ml-1">kg</span></>
                        : <span className="text-xs text-brand-muted/40">—</span>}
                    </td>
                    <td className="px-4 py-3 pr-6 text-right">
                      <span className="text-sm font-mono font-bold text-white">{item.total.toLocaleString('pt-BR')}</span>
                      <span className="text-[10px] text-brand-muted/60 ml-1">kg</span>
                    </td>
                    <td className="px-4 py-3 pr-6">
                      <div className="space-y-1">
                        <span className="text-xs font-mono text-emerald-400">{pct1.toFixed(1)}%</span>
                        <div className="h-1.5 bg-brand-surface/80 rounded-full overflow-hidden w-24">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct1}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-white/[0.08] bg-brand-card/60">
                <td colSpan={2} className="pl-6 py-4">
                  <span className="text-xs font-bold text-brand-muted uppercase tracking-wider">Total — {rows.length} produto{rows.length !== 1 ? 's' : ''}</span>
                </td>
                <td className="px-4 py-4 text-right">
                  <span className="text-sm font-mono font-bold text-emerald-400">{primeiraKg.toLocaleString('pt-BR')}</span>
                  <span className="text-[10px] text-brand-muted/60 ml-1">kg</span>
                  <span className="text-[10px] text-emerald-400/60 ml-2">({pctOf(primeiraKg, totalKg)}%)</span>
                </td>
                <td className="px-4 py-4 text-right">
                  <span className="text-sm font-mono font-bold text-amber-400">{segundaKg.toLocaleString('pt-BR')}</span>
                  <span className="text-[10px] text-brand-muted/60 ml-1">kg</span>
                  <span className="text-[10px] text-amber-400/60 ml-2">({pctOf(segundaKg, totalKg)}%)</span>
                </td>
                <td className="px-4 py-4 text-right">
                  <span className={`text-sm font-mono font-bold ${refugoKg > 0 ? 'text-red-400' : 'text-brand-muted'}`}>{refugoKg.toLocaleString('pt-BR')}</span>
                  <span className="text-[10px] text-brand-muted/60 ml-1">kg</span>
                  {refugoKg > 0 && <span className="text-[10px] text-red-400/60 ml-2">({pctOf(refugoKg, totalKg)}%)</span>}
                </td>
                <td className="px-4 py-4 pr-6 text-right">
                  <span className="text-sm font-mono font-bold text-white">{totalKg.toLocaleString('pt-BR')}</span>
                  <span className="text-[10px] text-brand-muted/60 ml-1">kg</span>
                </td>
                <td className="px-4 py-4 pr-6" />
              </tr>
            </tfoot>
          </table>
        </>)}
      </div>
    </div>
  );
}
