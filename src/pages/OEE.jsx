import { useState, useEffect, useMemo } from 'react';
import {
  Gauge, ChevronDown, ChevronRight, ChevronLeft,
  Activity, TrendingUp, Award,
} from 'lucide-react';
import {
  useAppStore, useAdminStore, useCsvStore, FACTORIES,
  parseCabos,
} from '../hooks/useStore';
import { subscribePlanningEntries } from '../services/firebase';
import {
  readSavedFile, readFileText, parseQualidadeCSV,
  getCsvMachineName,
} from '../utils/csvSync';
import { getMonthLabel } from '../utils/dates';

// ─── Quality tier (same logic as Qualidade.jsx) ───────────────────────────────
const REFUGO_CODES  = new Set(['AS', 'EJ', 'EI', 'EM', 'EP']);
const SEGUNDA_CODES = new Set(['A3', 'DV']);

function getTier(classif, lote) {
  const c = (classif || '').trim().toUpperCase();
  if (REFUGO_CODES.has(c))  return 'refugo';
  if (SEGUNDA_CODES.has(c) || (lote || '').toUpperCase().endsWith('A')) return 'segunda';
  return 'primeira';
}

function empresaToFactory(empresa) {
  const cod = String(empresa || '').replace(/^0+/, '');
  if (cod === '9') return 'matriz';
  if (cod === '7') return 'filial';
  return null;
}

// Normalise for matching: uppercase + strip diacritics + trim
function normCSV(s) {
  return (s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}
function normStr(s) { return (s || '').toUpperCase().trim(); }

// ─── OEE color scale ──────────────────────────────────────────────────────────
function oeeColor(pct) {
  if (pct >= 85) return '#10b981';
  if (pct >= 65) return '#f59e0b';
  return '#ef4444';
}

// ─── Group admin machines by their CSV machine name ───────────────────────────
function groupByCsvName(machineList, factory) {
  const groups = {}; // csvName → { csvName, machines: [mObj,...] }
  machineList.forEach((m) => {
    const csvName = getCsvMachineName(m.name, factory) || m.id;
    if (!groups[csvName]) groups[csvName] = { csvName, machines: [] };
    groups[csvName].machines.push(m);
  });
  return groups;
}

// Spindles for OEE theoretical:
// - flat entry (twist=null): full machine capacity for those cabos
// - S/Z entry: half the machine (split between two products)
// This mirrors how Planning stores 'planned' — flat entries use full spindles.
function activeSpindlesForEntry(machine, cabos, twist) {
  const total = machine?.spindles || 0;
  const byCount = cabos === 2 ? Math.floor(total / 2)
    : cabos === 3 ? Math.floor(total / 3)
    : total;
  if (twist && /SINGLE/i.test(machine?.name || '') && (cabos === 1 || cabos === 3)) {
    return Math.floor(byCount / 2);
  }
  return byCount;
}

// ─── OEE Calculation ─────────────────────────────────────────────────────────
function computeOEE({ planningEntries, csvRows, adminMachines, adminProducts, factory, yearMonth, cutoff }) {
  const monthStart = `${yearMonth}-01`;

  const factoriesToProcess = factory === 'all' ? ['matriz', 'filial'] : [factory];

  // Index CSV rows by factory + normalised machine name (diacritics stripped)
  const csvByFactMachine = {}; // `${fac}__${normCSV(machine)}` → [{...row}]
  csvRows.forEach((row) => {
    if (row.date < monthStart || row.date > cutoff) return;
    const rowFactory = empresaToFactory(row.empresa);
    const targets = rowFactory ? [rowFactory] : factoriesToProcess;
    targets.forEach((f) => {
      const key = `${f}__${normCSV(row.machine)}`;
      if (!csvByFactMachine[key]) csvByFactMachine[key] = [];
      csvByFactMachine[key].push(row);
    });
  });

  const result = {};

  factoriesToProcess.forEach((fac) => {
    const groups = groupByCsvName(adminMachines[fac] || [], fac);
    let fPlannedMin = 0, fRunMin = 0, fActual = 0, fTheoretical = 0, fFirstQ = 0;
    const machineResults = {};

    Object.values(groups).forEach(({ csvName, machines }) => {
      // Planning entries for ALL machines in this group, up to cutoff
      const allIds = new Set(machines.map((m) => m.id));
      const mEntries = planningEntries.filter(
        (e) => e.factory === fac && allIds.has(e.machine)
          && e.date >= monthStart && e.date <= cutoff,
      );
      if (mEntries.length === 0) return;

      // Group entries by machineId+date (handles S/Z split)
      const byDate = {};
      mEntries.forEach((e) => {
        const k = `${e.machine}__${e.date}`;
        if (!byDate[k]) byDate[k] = [];
        byDate[k].push(e);
      });

      // ── Availability ──────────────────────────────────────────────────────
      let plannedMin = 0;
      let downtimeMin = 0;

      Object.entries(byDate).forEach(([, dayEntries]) => {
        // Representative entry for this day (primary: S or flat)
        const primary = dayEntries.find((e) => e.twist === 'S' || !e.twist) || dayEntries[0];
        const ct = primary.cellType;

        if (ct === 'producao' || ct === 'parada_np') {
          plannedMin += 1440;
          if (ct === 'parada_np') {
            downtimeMin += 1440; // entire day is unplanned stop
          } else {
            // Partial PNPs within a production day
            const pnpMin = (primary.pnps || []).reduce((s, p) => s + (p.minutos || 0), 0);
            downtimeMin += pnpMin;
          }
        }
        // parada_p and manutencao are scheduled — excluded from OEE planned time
      });

      if (plannedMin === 0) return;

      const runMin = Math.max(0, plannedMin - downtimeMin);
      const dFactor = runMin / plannedMin;
      const disponibilidade = dFactor * 100;

      // ── Theoretical max (100% capacity, no efficiency discount) ───────────
      let theoreticalKg = 0;
      const productAccum = {}; // productId → { productName, theoreticalKg, actualKg, firstQKg }

      Object.entries(byDate).forEach(([dayKey, dayEntries]) => {
        const primary = dayEntries.find((e) => e.twist === 'S' || !e.twist) || dayEntries[0];
        if (primary.cellType !== 'producao') return;

        // Find the correct machine object for spindle lookup
        const mObj = machines.find((m) => m.id === primary.machine) || machines[0];

        dayEntries.forEach((e) => {
          if (!e.product) return;
          const prod = adminProducts.find(
            (p) => p.id === e.product || p.codigoMicrodata === e.product,
          );
          if (!prod?.prodDiaPosicao) return;

          const cabos = parseCabos(prod.nome || e.productName) || 1;
          const fusos = activeSpindlesForEntry(mObj, cabos, e.twist);
          const theoDay = fusos * prod.prodDiaPosicao;
          theoreticalKg += theoDay;

          if (!productAccum[e.product]) {
            productAccum[e.product] = {
              productId: e.product,
              codigoMicrodata: prod.codigoMicrodata || '',
              productName: e.productName || prod.nome || e.product,
              theoreticalKg: 0, actualKg: 0, firstQKg: 0,
            };
          }
          productAccum[e.product].theoreticalKg += theoDay;
        });
      });

      // ── Actual production & quality from CSV ──────────────────────────────
      // Primary: match by CSV machine group name (diacritics stripped)
      let machCsvRows = csvByFactMachine[`${fac}__${normCSV(csvName)}`] || [];

      // Fallback: CSV may use admin machine IDs (e.g. "C01") instead of group names
      if (machCsvRows.length === 0) {
        const seen = new Set();
        machines.forEach((m) => {
          (csvByFactMachine[`${fac}__${normCSV(m.id)}`] || []).forEach((r) => {
            if (!seen.has(r)) { seen.add(r); machCsvRows = [...machCsvRows, r]; }
          });
        });
      }

      // Working dates = unique dates where any machine in the group was 'producao'
      const workingDateSet = new Set(
        Object.entries(byDate)
          .filter(([, es]) => (es.find((e) => !e.twist || e.twist === 'S') || es[0]).cellType === 'producao')
          .map(([k]) => k.split('__')[1]),
      );

      // Second fallback: match by planned product Microdata codes + working date + factory.
      // Handles cases where CSV exports an unexpected machine name.
      // Uses ALL mEntries (not just productAccum) so products without prodDiaPosicao
      // still contribute their codes to the search.
      if (machCsvRows.length === 0) {
        const plannedCodes = new Set();
        mEntries.forEach((e) => {
          if (!e.product) return;
          plannedCodes.add(normStr(e.product));
          const p = adminProducts.find(
            (ap) => ap.id === e.product || ap.codigoMicrodata === e.product,
          );
          if (p?.codigoMicrodata) plannedCodes.add(normStr(p.codigoMicrodata));
        });
        if (plannedCodes.size > 0) {
          const seen = new Set();
          csvRows.forEach((r) => {
            if (r.date < monthStart || r.date > cutoff) return;
            if (!workingDateSet.has(r.date)) return;
            if (!plannedCodes.has(normStr(r.productCode))) return;
            const rowFac = empresaToFactory(r.empresa);
            if (rowFac && rowFac !== fac) return;
            if (!seen.has(r)) { seen.add(r); machCsvRows = [...machCsvRows, r]; }
          });
        }
      }

      let actualKg = 0;
      let firstQKg = 0;

      machCsvRows
        .filter((r) => workingDateSet.has(r.date))
        .forEach((row) => {
          const tier = getTier(row.classif, row.lote);
          actualKg  += row.quantity;
          if (tier === 'primeira') firstQKg += row.quantity;

          // Attribute to product
          const matchProd = adminProducts.find(
            (p) => normStr(p.id) === normStr(row.productCode)
              || normStr(p.codigoMicrodata || '') === normStr(row.productCode),
          );
          if (matchProd && productAccum[matchProd.id]) {
            productAccum[matchProd.id].actualKg  += row.quantity;
            if (tier === 'primeira') productAccum[matchProd.id].firstQKg += row.quantity;
          }
        });

      // ── OEE metrics ───────────────────────────────────────────────────────
      const perfDenom   = theoreticalKg * dFactor;
      const performance = perfDenom > 0 ? Math.min(100, (actualKg / perfDenom) * 100) : 0;
      // qualidade = null quando sem dados CSV (não exibir como 100% falso)
      const qualidade   = actualKg > 0 ? (firstQKg / actualKg) * 100 : null;
      const oee         = (disponibilidade / 100) * (performance / 100) * ((qualidade ?? 100) / 100) * 100;

      // Per-product OEE (shares availability with machine)
      const productsResult = {};
      Object.values(productAccum).forEach((pa) => {
        if (pa.theoreticalKg === 0 && pa.actualKg === 0) return;
        const pPerfDenom = pa.theoreticalKg * dFactor;
        const pPerf = pPerfDenom > 0 ? Math.min(100, (pa.actualKg / pPerfDenom) * 100) : 0;
        const pQual = pa.actualKg > 0 ? (pa.firstQKg / pa.actualKg) * 100 : null;
        const pOee  = (disponibilidade / 100) * (pPerf / 100) * ((pQual ?? 100) / 100) * 100;
        productsResult[pa.productId] = { ...pa, performance: pPerf, qualidade: pQual, oee: pOee };
      });

      machineResults[csvName] = {
        csvName,
        machineIds: machines.map((m) => m.id),
        workingDays: workingDateSet.size,
        plannedMin, runMin,
        disponibilidade, performance, qualidade, oee,
        theoreticalKg, actualKg, firstQKg,
        products: productsResult,
      };

      fPlannedMin   += plannedMin;
      fRunMin       += runMin;
      fActual       += actualKg;
      fTheoretical  += theoreticalKg;
      fFirstQ       += firstQKg;
    });

    if (Object.keys(machineResults).length === 0) return;

    const fDFactor = fPlannedMin > 0 ? fRunMin / fPlannedMin : 0;
    const fD = fDFactor * 100;
    const fP = (fTheoretical * fDFactor) > 0
      ? Math.min(100, (fActual / (fTheoretical * fDFactor)) * 100) : 0;
    const fQ   = fActual > 0 ? (fFirstQ / fActual) * 100 : null;
    const fOEE = fD * fP * ((fQ ?? 100)) / 10000;

    const factData = FACTORIES.find((f) => f.id === fac) || {};
    result[fac] = {
      label: factData.name || fac,
      color: factData.color || '#64748b',
      disponibilidade: fD, performance: fP, qualidade: fQ, oee: fOEE,
      actualKg: fActual, theoreticalKg: fTheoretical,
      machines: machineResults,
    };
  });

  return result;
}

// ─── UI Components ────────────────────────────────────────────────────────────
function GaugeBar({ pct, width = 72 }) {
  const v = Math.min(100, Math.max(0, pct || 0));
  const c = oeeColor(v);
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative rounded-full overflow-hidden bg-white/10" style={{ width, height: 5 }}>
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${v}%`, backgroundColor: c }} />
      </div>
      <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: c }}>
        {v.toFixed(1)}%
      </span>
    </div>
  );
}

function MetricPill({ label, value, color }) {
  return (
    <div className="flex flex-col items-end sm:items-center">
      <span className="text-[8px] text-brand-muted uppercase font-bold tracking-wider leading-none mb-0.5">{label}</span>
      <span className="text-[11px] font-mono font-bold tabular-nums" style={{ color: value === null ? '#475569' : color }}>
        {value === null ? '—' : `${Math.min(100, value).toFixed(1)}%`}
      </span>
    </div>
  );
}

// ─── OEE Page ─────────────────────────────────────────────────────────────────
export default function OEEPage() {
  const { factory, month, changeMonth, getYearMonth } = useAppStore();
  const { machines: adminMachines, products: adminProducts } = useAdminStore();
  const { rows: csvRows, fileName: csvFile, lastSync } = useCsvStore();

  const yearMonth  = getYearMonth();
  const monthLabel = getMonthLabel(month.year, month.month);
  const today      = new Date().toISOString().split('T')[0];
  const isCurrentMonth = yearMonth === today.slice(0, 7);
  const lastDayOfMonth = new Date(month.year, month.month + 1, 0).getDate();
  const cutoff = isCurrentMonth
    ? today
    : `${yearMonth}-${String(lastDayOfMonth).padStart(2, '0')}`;

  // Planning entries from Firestore
  const [planningEntries, setPlanningEntries] = useState([]);
  useEffect(() => {
    const unsub = subscribePlanningEntries(factory, yearMonth, setPlanningEntries);
    return () => unsub();
  }, [factory, yearMonth]);

  // Auto-load from IndexedDB on first render if shared store is still empty
  useEffect(() => {
    if (useCsvStore.getState().rows.length > 0) return;
    readSavedFile('producao-csv').then(async (f) => {
      if (!f) return;
      try {
        const text = await readFileText(f);
        const qRows = parseQualidadeCSV(text);
        const cs = useCsvStore.getState();
        cs.setRows(qRows);
        cs.setFileName(f.name);
        cs.setLastSync(new Date());
      } catch { /* ignore */ }
    });
  }, []);

  // Accordion
  const [expandedFactories, setExpandedFactories] = useState(new Set(['matriz', 'filial']));
  const [expandedMachines,  setExpandedMachines]  = useState(new Set());

  const toggleFactory = (id) => setExpandedFactories((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleMachine = (key) => setExpandedMachines((prev) => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
  });

  // Compute OEE tree
  const oeeTree = useMemo(() => computeOEE({
    planningEntries, csvRows, adminMachines, adminProducts, factory, yearMonth, cutoff,
  }), [planningEntries, csvRows, adminMachines, adminProducts, factory, yearMonth, cutoff]);

  // Global KPIs
  const global = useMemo(() => {
    let pMin = 0, rMin = 0, actual = 0, theo = 0, firstQ = 0;
    Object.values(oeeTree).forEach((f) => {
      Object.values(f.machines).forEach((m) => {
        pMin   += m.plannedMin;
        rMin   += m.runMin;
        actual += m.actualKg;
        theo   += m.theoreticalKg;
        firstQ += m.firstQKg;
      });
    });
    if (pMin === 0) return null;
    const dF  = rMin / pMin;
    const D   = dF * 100;
    const P   = (theo * dF) > 0 ? Math.min(100, actual / (theo * dF) * 100) : 0;
    const Q   = actual > 0 ? firstQ / actual * 100 : null;
    const OEE = D * P * (Q ?? 100) / 10000;
    return { D, P, Q, OEE, actual, theo };
  }, [oeeTree]);

  const hasTree = Object.keys(oeeTree).length > 0;

  return (
    <div className="flex flex-col bg-brand-bg" style={{ minHeight: 'calc(100vh - 56px)' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-brand-border bg-brand-surface/30 shrink-0 gap-2 flex-wrap">
        <div>
          <h1 className="text-base sm:text-xl font-bold text-white flex items-center gap-2 tracking-tight">
            <Gauge size={18} className="text-brand-cyan shrink-0" />
            OEE de Produção
          </h1>
          <p className="text-[10px] text-brand-muted mt-0.5 uppercase tracking-widest font-black">
            {monthLabel} · Acumulado até {isCurrentMonth
              ? today.split('-').reverse().join('/')
              : `${String(lastDayOfMonth).padStart(2, '0')}/${String(month.month + 1).padStart(2, '0')}/${month.year}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Month navigation */}
          <div className="flex items-center gap-1 bg-brand-card border border-brand-border rounded-xl p-1">
            <button onClick={() => changeMonth(-1)} className="p-1 sm:p-1.5 hover:bg-white/5 rounded-lg text-brand-muted hover:text-white transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-bold text-white px-2 min-w-[80px] text-center capitalize">
              {new Date(month.year, month.month).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
            </span>
            <button onClick={() => changeMonth(1)} className="p-1 sm:p-1.5 hover:bg-white/5 rounded-lg text-brand-muted hover:text-white transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>

          {/* CSV status (shared with Realizado) */}
          {csvFile ? (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border bg-brand-cyan/5 border-brand-cyan/10 text-brand-muted">
              <Activity size={11} className="text-brand-cyan shrink-0" />
              <span className="font-mono text-white truncate max-w-[120px]">{csvFile}</span>
              {lastSync && <span>· {lastSync.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border border-brand-border text-brand-muted/60">
              <Activity size={11} className="shrink-0" />
              Sincronize em Realizado
            </div>
          )}
        </div>
      </div>

      {/* ── Global KPI bar ── */}
      {global && (
        <div className="px-4 sm:px-6 py-2 sm:py-3 flex items-center gap-5 sm:gap-10 border-b border-brand-border/40 bg-brand-surface/10 shrink-0 flex-wrap">
          {[
            { label: 'OEE Global',  value: global.OEE, icon: Gauge,     color: oeeColor(global.OEE) },
            { label: 'Disponibil.', value: global.D,   icon: Activity,   color: '#22d3ee' },
            { label: 'Performance', value: global.P,   icon: TrendingUp, color: '#a78bfa' },
            { label: 'Qualidade',   value: global.Q,   icon: Award,      color: '#34d399' },
          ].map((kpi) => (
            <div key={kpi.label} className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/5 border border-brand-border flex items-center justify-center shrink-0">
                <kpi.icon size={13} className="text-brand-muted" />
              </div>
              <div>
                <p className="text-[8px] text-brand-muted uppercase font-bold tracking-tighter leading-none mb-1">{kpi.label}</p>
                <GaugeBar pct={kpi.value} width={56} />
              </div>
            </div>
          ))}
          <div className="hidden sm:flex items-center gap-5 ml-auto">
            <div>
              <p className="text-[8px] text-brand-muted uppercase font-bold tracking-tighter leading-none mb-1">Realizado</p>
              <span className="text-xs font-mono font-bold text-white">{(global.actual / 1000).toFixed(2)} t</span>
            </div>
            <div>
              <p className="text-[8px] text-brand-muted uppercase font-bold tracking-tighter leading-none mb-1">Teórico</p>
              <span className="text-xs font-mono font-bold text-brand-muted">{(global.theo / 1000).toFixed(2)} t</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto px-0 sm:px-4 lg:px-6 py-0 sm:py-4 space-y-0 sm:space-y-3">

        {!hasTree ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-surface border border-brand-border flex items-center justify-center">
              <Gauge size={28} className="text-brand-muted" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white mb-1">Sem dados de planejamento</p>
              <p className="text-xs text-brand-muted max-w-xs">
                Planeje o mês de {monthLabel} na página de Planejamento para visualizar o OEE.
              </p>
            </div>
          </div>
        ) : (
          Object.entries(oeeTree).map(([facId, facData]) => (
            <div key={facId} className="bg-brand-card sm:rounded-2xl border-y sm:border border-brand-border overflow-hidden">

              {/* Factory row */}
              <button onClick={() => toggleFactory(facId)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: facData.color }} />
                <span className="text-sm font-bold text-white flex-1 truncate">{facData.label}</span>

                {/* Desktop metrics */}
                <div className="hidden sm:flex items-center gap-5 mr-3 shrink-0">
                  <MetricPill label="Disp."  value={facData.disponibilidade} color="#22d3ee" />
                  <MetricPill label="Perf."  value={facData.performance}     color="#a78bfa" />
                  <MetricPill label="Qual."  value={facData.qualidade}        color="#34d399" />
                </div>
                <div className="hidden sm:flex items-center gap-1.5 mr-2">
                  <span className="text-[9px] font-bold text-brand-muted uppercase">OEE</span>
                  <GaugeBar pct={facData.oee} width={72} />
                </div>
                <div className="sm:hidden mr-2">
                  <GaugeBar pct={facData.oee} width={52} />
                </div>
                <div className="text-brand-muted shrink-0">
                  {expandedFactories.has(facId) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </button>

              {/* Machine rows */}
              {expandedFactories.has(facId) && (
                <div className="border-t border-brand-border/40">
                  {Object.values(facData.machines).map((mach) => {
                    const machKey = `${facId}__${mach.csvName}`;
                    const expanded = expandedMachines.has(machKey);
                    return (
                      <div key={mach.csvName} className="border-b border-brand-border/20 last:border-b-0">

                        {/* Machine row */}
                        <button onClick={() => toggleMachine(machKey)}
                          className="w-full flex items-center gap-3 px-4 sm:px-6 py-2.5 hover:bg-white/[0.02] transition-colors text-left">
                          <div className="w-4 shrink-0 flex justify-center">
                            {expanded
                              ? <ChevronDown  size={11} className="text-brand-muted" />
                              : <ChevronRight size={11} className="text-brand-muted" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium text-white truncate block leading-tight">{mach.csvName}</span>
                            <span className="text-[9px] text-brand-muted/50 font-mono hidden sm:block leading-tight">
                              {mach.machineIds.join(' · ')} · {mach.workingDays}d
                            </span>
                          </div>
                          <div className="hidden sm:flex items-center gap-5 mr-3 shrink-0">
                            <MetricPill label="Disp."  value={mach.disponibilidade} color="#22d3ee" />
                            <MetricPill label="Perf."  value={mach.performance}     color="#a78bfa" />
                            <MetricPill label="Qual."  value={mach.qualidade}        color="#34d399" />
                          </div>
                          <div className="flex items-center gap-1.5 mr-1 shrink-0">
                            <span className="hidden sm:block text-[9px] font-bold text-brand-muted uppercase">OEE</span>
                            <GaugeBar pct={mach.oee} width={60} />
                          </div>
                        </button>

                        {/* Product rows */}
                        {expanded && (
                          <div className="bg-brand-bg/40 border-t border-brand-border/20">

                            {/* Column header */}
                            <div className="hidden sm:grid grid-cols-[1fr_80px_80px_56px_56px_56px_90px] gap-x-3 px-12 py-1.5 border-b border-brand-border/10">
                              {['Produto', 'Realizado', 'Teórico', 'Disp.', 'Perf.', 'Qual.', 'OEE'].map((h) => (
                                <span key={h} className="text-[8px] font-bold text-brand-muted uppercase tracking-wider text-right first:text-left">{h}</span>
                              ))}
                            </div>

                            {Object.values(mach.products).length === 0 ? (
                              <p className="px-12 py-3 text-[10px] text-brand-muted/40 italic">
                                {csvRows.length === 0
                                  ? 'Carregue o CSV para ver dados por produto.'
                                  : 'Sem produção realizada neste período.'}
                              </p>
                            ) : (
                              Object.values(mach.products).map((prod) => (
                                <div key={prod.productId}
                                  className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_80px_80px_56px_56px_56px_90px] gap-x-3 px-12 py-2 border-b border-brand-border/10 last:border-b-0 hover:bg-white/[0.015] items-center">
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-medium text-white truncate leading-tight">{prod.productName}</p>
                                    <p className="text-[9px] text-brand-muted font-mono leading-tight">{prod.codigoMicrodata || prod.productId}</p>
                                  </div>
                                  <span className="hidden sm:block text-[10px] font-mono text-white text-right">
                                    {prod.actualKg > 0 ? `${(prod.actualKg / 1000).toFixed(2)}t` : '—'}
                                  </span>
                                  <span className="hidden sm:block text-[10px] font-mono text-brand-muted text-right">
                                    {prod.theoreticalKg > 0 ? `${(prod.theoreticalKg / 1000).toFixed(2)}t` : '—'}
                                  </span>
                                  <span className="hidden sm:block text-[10px] font-mono text-right tabular-nums" style={{ color: '#22d3ee' }}>
                                    {mach.disponibilidade.toFixed(1)}%
                                  </span>
                                  <span className="hidden sm:block text-[10px] font-mono text-right tabular-nums" style={{ color: '#a78bfa' }}>
                                    {prod.performance.toFixed(1)}%
                                  </span>
                                  <span className="hidden sm:block text-[10px] font-mono text-right tabular-nums" style={{ color: prod.qualidade != null ? '#34d399' : '#475569' }}>
                                    {prod.qualidade != null ? `${prod.qualidade.toFixed(1)}%` : '—'}
                                  </span>
                                  <div className="flex justify-end">
                                    <GaugeBar pct={prod.oee} width={52} />
                                  </div>
                                </div>
                              ))
                            )}

                            {/* Machine summary */}
                            <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_80px_80px_56px_56px_56px_90px] gap-x-3 px-12 py-2 bg-brand-surface/40 border-t border-brand-border/20 items-center">
                              <span className="text-[9px] font-bold text-brand-muted uppercase tracking-wider truncate">
                                Total
                              </span>
                              <span className="hidden sm:block text-[10px] font-mono font-bold text-white text-right">
                                {(mach.actualKg / 1000).toFixed(2)}t
                              </span>
                              <span className="hidden sm:block text-[10px] font-mono text-brand-muted text-right">
                                {(mach.theoreticalKg / 1000).toFixed(2)}t
                              </span>
                              <span className="hidden sm:block text-[10px] font-mono font-bold text-right tabular-nums" style={{ color: '#22d3ee' }}>
                                {mach.disponibilidade.toFixed(1)}%
                              </span>
                              <span className="hidden sm:block text-[10px] font-mono font-bold text-right tabular-nums" style={{ color: '#a78bfa' }}>
                                {mach.performance.toFixed(1)}%
                              </span>
                              <span className="hidden sm:block text-[10px] font-mono font-bold text-right tabular-nums" style={{ color: mach.qualidade != null ? '#34d399' : '#475569' }}>
                                {mach.qualidade != null ? `${mach.qualidade.toFixed(1)}%` : '—'}
                              </span>
                              <div className="flex justify-end">
                                <GaugeBar pct={mach.oee} width={60} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}

        {/* ── Legend ── */}
        <div className="flex items-center gap-5 px-4 sm:px-0 py-4 flex-wrap">
          {[
            { label: 'World Class ≥ 85%', color: '#10b981' },
            { label: 'Aceitável 65–85%',  color: '#f59e0b' },
            { label: 'Crítico < 65%',     color: '#ef4444' },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
              <span className="text-[10px] text-brand-muted">{l.label}</span>
            </div>
          ))}
          <span className="text-[10px] text-brand-muted/40 ml-auto hidden sm:block">
            Disponibilidade: PNP / Parada NP · Performance: Realizado ÷ Teórico × D · OEE = D × P × Q
          </span>
        </div>
      </div>
    </div>
  );
}
