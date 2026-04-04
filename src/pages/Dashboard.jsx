import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Activity, Package, Cpu, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useAppStore, usePlanningStore, useProductionStore, useAdminStore } from '../hooks/useStore';
import { subscribeProductionRecords, subscribePlanningEntries } from '../services/firebase';
import { seedDemoData } from '../utils/seedData';
import { getDaysInMonth, isToday, isPast, getMonthLabel } from '../utils/dates';

function KpiCard({ label, value, unit, sub, trend, accentColor, icon: Icon }) {
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? 'text-brand-success' : trend < 0 ? 'text-brand-danger' : 'text-brand-muted';
  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-5 card-hover relative overflow-hidden"
      style={{ borderTop: `2px solid ${accentColor}` }}>
      <div className="flex justify-between items-start mb-3">
        <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">{label}</p>
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-white/5 border border-brand-border flex items-center justify-center">
            <Icon size={16} className="text-brand-cyan" />
          </div>
        )}
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-mono font-bold text-white">{value}</span>
        {unit && <span className="text-sm text-brand-muted mb-1">{unit}</span>}
      </div>
      {sub && (
        <div className="flex items-center gap-1 mt-2">
          <TrendIcon size={11} className={trendColor} />
          <span className="text-xs text-brand-muted">{sub}</span>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { factory, month, getYearMonth, changeMonth } = useAppStore();
  const { entriesMap, setEntriesFromArray } = usePlanningStore();
  const { records, setRecords } = useProductionStore();
  const { machines: adminMachines } = useAdminStore();

  const machines = factory === 'all'
    ? [...(adminMachines.matriz || []), ...(adminMachines.filial || [])]
    : adminMachines[factory] || [];
  const yearMonth = getYearMonth();
  const days = getDaysInMonth(month.year, month.month);
  const monthLabel = getMonthLabel(month.year, month.month);

  useEffect(() => {
    const unsubP = subscribePlanningEntries(factory, yearMonth, (data) => {
      if (data.length === 0) { const { entries: d } = seedDemoData(); setEntriesFromArray(d.filter((e) => e.factory === factory && e.date?.startsWith(yearMonth))); }
      else setEntriesFromArray(data);
    });
    const unsubR = subscribeProductionRecords(factory, yearMonth, (data) => {
      if (data.length === 0) { const { production: d } = seedDemoData(); setRecords(d.filter((r) => r.factory === factory && r.date?.startsWith(yearMonth))); }
      else setRecords(data);
    });
    return () => { unsubP(); unsubR(); };
  }, [factory, yearMonth]);

  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  useEffect(() => { 
    setDateRange({ start: '', end: '' }); 
    setShowDatePicker(false);
  }, [yearMonth]);

  const allEntries = Object.values(entriesMap);
  const basePlanningEntries = allEntries.filter(
    (e) => (e.cellType === 'producao' || !e.cellType) &&
           (factory === 'all' || e.factory === factory),
  );
  
  const hasRange = dateRange.start && dateRange.end;
  const activePlanning = hasRange ? basePlanningEntries.filter((e) => e.date >= dateRange.start && e.date <= dateRange.end) : basePlanningEntries;
  const activeRecords  = hasRange ? records.filter((r) => r.date >= dateRange.start && r.date <= dateRange.end) : records;

  const totalPlanned = Math.round(activePlanning.reduce((s, e) => s + (e.planned || 0), 0));
  const totalActual  = Math.round(activeRecords.reduce((s, r) => s + (r.actual || 0), 0) * 100) / 100;
  const adherence    = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;
  const pastDays     = days.filter((d) => isPast(d) || isToday(d));

  const visibleDays = hasRange 
    ? days.filter(d => d >= dateRange.start && d <= dateRange.end)
    : pastDays.slice(-15);

  const chartData = useMemo(() => visibleDays.map((date) => ({
    day:     parseInt(date.split('-')[2]),
    planned: basePlanningEntries.filter((e) => e.date === date).reduce((s, e) => s + (e.planned || 0), 0),
    actual:  records.filter((r) => r.date === date).reduce((s, r) => s + (r.actual || 0), 0),
  })), [basePlanningEntries, records, visibleDays]);

  const productMix = useMemo(() => {
    const map = {};
    activePlanning.forEach((e) => { if (!map[e.productName]) map[e.productName] = 0; map[e.productName] += e.planned || 0; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [activePlanning]);

  const adColor = adherence >= 90 ? '#10b981' : adherence >= 80 ? '#f59e0b' : '#ef4444';

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-brand-muted mt-0.5 capitalize">{monthLabel}</p>
        </div>

        {/* Filtros */}
        <div className="flex bg-brand-surface border border-brand-border rounded-lg p-1 self-start sm:self-auto mt-2 sm:mt-0 relative">
          <div className="flex items-center space-x-1">
            <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-brand-card rounded text-brand-muted hover:text-white transition-colors">
              <ChevronLeft size={18} />
            </button>
            <span 
              className="text-sm font-medium text-white px-3 capitalize min-w-[120px] text-center cursor-pointer select-none hover:text-brand-cyan transition-colors"
              onDoubleClick={() => setShowDatePicker(true)}
              title="Duplo clique para filtrar o período"
            >
              {hasRange ? `${dateRange.start.split('-').reverse().join('/')} à ${dateRange.end.split('-').reverse().join('/')}` : monthLabel}
            </span>
            <button onClick={() => changeMonth(1)} className="p-1 hover:bg-brand-card rounded text-brand-muted hover:text-white transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Date Picker Popover */}
          {showDatePicker && (
            <div className="absolute top-[calc(100%+0.5rem)] sm:right-0 sm:left-auto left-0 z-50 bg-brand-card border border-brand-border rounded-xl p-4 shadow-xl flex flex-col gap-3 animate-fade-in shadow-black/50">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="flex flex-col gap-1 w-full sm:w-auto">
                  <label className="text-[10px] text-brand-muted uppercase font-bold tracking-widest">Data Inicial</label>
                  <input 
                    type="date" 
                    className="bg-brand-surface text-white text-sm rounded border border-brand-border p-2 focus:outline-none focus:border-brand-cyan w-full"
                    value={dateRange.start}
                    onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1 w-full sm:w-auto">
                  <label className="text-[10px] text-brand-muted uppercase font-bold tracking-widest">Data Final</label>
                  <input 
                    type="date" 
                    className="bg-brand-surface text-white text-sm rounded border border-brand-border p-2 focus:outline-none focus:border-brand-cyan w-full"
                    value={dateRange.end}
                    min={dateRange.start}
                    onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button 
                  onClick={() => { setDateRange({start:'', end:''}); setShowDatePicker(false); }}
                  className="text-xs text-brand-muted hover:text-white px-3 py-1.5 rounded transition-colors"
                  title="Mostrar mês inteiro"
                >
                  Limpar
                </button>
                <button 
                  onClick={() => setShowDatePicker(false)}
                  className="text-xs bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 font-bold rounded px-4 py-1.5 hover:bg-brand-cyan/20 transition-colors"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          label="Total Planejado" 
          value={totalPlanned >= 1000 ? `${(totalPlanned/1000).toFixed(1)}k` : totalPlanned} 
          unit="kg" 
          accentColor="#8b5cf6" 
          icon={Calendar}
          sub={hasRange ? 'Período' : `${days.length} dias no mês`} 
        />
        <KpiCard
          label="Total Realizado"
          value={totalActual >= 1000 ? `${(totalActual/1000).toFixed(1)}k` : totalActual.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
          unit="kg"
          accentColor="#22d3ee" 
          icon={TrendingUp}
          trend={totalActual >= totalPlanned * 0.9 ? 1 : -1} 
          sub={hasRange ? 'Período' : `${pastDays.length} dias apurados`} 
        />
        <KpiCard 
          label="Aderência" 
          value={`${adherence}%`} 
          accentColor={adColor} 
          icon={Activity}
          trend={adherence >= 90 ? 1 : -1} 
          sub="planejado vs realizado" 
        />
        <KpiCard 
          label="Máquinas" 
          value={machines.length} 
          accentColor="#f97316" 
          icon={Cpu}
          sub={factory === 'all' ? 'Todas as Unidades' : factory === 'matriz' ? 'Corradi Matriz' : 'Corradi Filial'} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-brand-card border border-brand-border rounded-2xl p-5" style={{ borderTop: '2px solid #22d3ee' }}>
          <h3 className="text-xs font-bold text-brand-muted uppercase tracking-widest mb-4 flex items-center gap-2">
            <Activity size={13} className="text-brand-cyan" /> Produção Diária (kg)
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barGap={2}>
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={40}
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip contentStyle={{ background: '#1a2744', border: '1px solid #1e3058', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: '#94a3b8' }} formatter={(v, n) => [`${v.toLocaleString('pt-BR')} kg`, n === 'planned' ? 'Planejado' : 'Realizado']} />
                <Bar dataKey="planned" fill="rgba(34,211,238,0.08)" radius={[4,4,0,0]} />
                <Bar dataKey="actual" radius={[4,4,0,0]}>
                  {chartData.map((e, i) => (
                    <Cell key={i} fill={e.actual >= e.planned * 0.9 ? '#10b981' : e.actual >= e.planned * 0.75 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-brand-muted text-sm">Sem dados para exibir</div>
          )}
        </div>

        {/* Product mix */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5" style={{ borderTop: '2px solid #f97316' }}>
          <h3 className="text-xs font-bold text-brand-muted uppercase tracking-widest mb-4 flex items-center gap-2">
            <Package size={13} className="text-brand-orange" /> Mix de Produtos
          </h3>
          <div className="space-y-3">
            {productMix.length > 0 ? productMix.map(([name, val]) => {
              const pct = totalPlanned > 0 ? Math.round((val / totalPlanned) * 100) : 0;
              return (
                <div key={name}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-white font-medium">{name}</span>
                    <span className="text-brand-muted font-mono whitespace-nowrap">
                      {val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} kg ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 bg-brand-surface rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: '#f97316' }} />
                  </div>
                </div>
              );
            }) : <p className="text-brand-muted text-sm text-center py-8">Sem dados</p>}
          </div>
        </div>
      </div>

      {/* Machine status grid */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-5">
        <h3 className="text-xs font-bold text-brand-muted uppercase tracking-widest mb-6 flex items-center gap-2">
          <Cpu size={16} className="text-brand-cyan" /> 
          Status das Máquinas — {hasRange ? 'Período' : 'Hoje'}
          {factory === 'all' && <span className="ml-2 text-[10px] text-brand-muted opacity-50 px-2 border-l border-brand-border">Visão consolidada Matriz + Filial</span>}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {machines.map((machine) => {
            let planned = 0;
            let actual = 0;
            
            if (hasRange) {
              planned = basePlanningEntries.filter((e) => e.machine === machine.id && e.date >= dateRange.start && e.date <= dateRange.end).reduce((s, e) => s + (e.planned || 0), 0);
              actual  = records.filter((r) => r.machine === machine.id && r.date >= dateRange.start && r.date <= dateRange.end).reduce((s, r) => s + (r.actual || 0), 0);
            } else {
              const today = new Date().toISOString().split('T')[0];
              planned = basePlanningEntries.filter((e) => e.machine === machine.id && e.date === today).reduce((s, e) => s + (e.planned || 0), 0);
              actual  = records.filter((r) => r.machine === machine.id && r.date === today).reduce((s, r) => s + (r.actual || 0), 0);
            }
            
            const pct = planned > 0 ? Math.round((actual / planned) * 100) : null;
            const color = pct === null ? '#1e3058' : pct >= 95 ? '#10b981' : pct >= 80 ? '#22d3ee' : pct >= 65 ? '#f59e0b' : '#ef4444';
            return (
              <div key={machine.id} className="bg-brand-surface border border-brand-border rounded-xl p-4 transition-all hover:bg-white/5 group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white group-hover:text-brand-cyan transition-colors">{machine.id}</span>
                  <span className="w-2 h-2 rounded-full pulse-dot shadow-[0_0_8px_rgba(34,211,238,0.5)]" style={{ backgroundColor: color }} />
                </div>
                <p className="text-[10px] text-brand-muted truncate mb-2">{machine.name}</p>
                <div className="flex items-end justify-between">
                  <p className="text-sm font-mono font-bold" style={{ color }}>
                    {pct !== null ? `${pct}%` : '—'}
                  </p>
                  <p className="text-[9px] text-brand-muted">{actual.toLocaleString('pt-BR')}kg</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
