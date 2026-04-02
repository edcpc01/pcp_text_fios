import { useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Activity, Package, Cpu } from 'lucide-react';
import { useAppStore, usePlanningStore, useProductionStore, MACHINES } from '../hooks/useStore';
import { subscribeProductionRecords, subscribePlanningEntries } from '../services/firebase';
import { seedDemoData } from '../utils/seedData';
import { getDaysInMonth, isSunday, isToday, isPast, getMonthLabel } from '../utils/dates';

function KpiCard({ label, value, unit, sub, trend, color }) {
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-slate-500';
  return (
    <div className="bg-brand-navy border border-white/[0.06] rounded-2xl p-5 card-hover relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-10"
        style={{ backgroundColor: color, transform: 'translate(30%, -30%)' }} />
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">{label}</p>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-mono font-bold text-slate-100">{value}</span>
        {unit && <span className="text-sm text-slate-500 mb-1">{unit}</span>}
      </div>
      {sub && (
        <div className="flex items-center gap-1 mt-2">
          <TrendIcon size={12} className={trendColor} />
          <span className="text-xs text-slate-500">{sub}</span>
        </div>
      )}
    </div>
  );
}

function MachineStatusGrid({ machines, entries, records, factory }) {
  return (
    <div className="bg-brand-navy border border-white/[0.06] rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
        <Cpu size={15} className="text-brand-doptex" /> Status das Máquinas
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {machines.map((machine) => {
          const todayStr = new Date().toISOString().split('T')[0];
          const planned = entries.filter((e) => e.machine === machine.id && e.date === todayStr).reduce((s, e) => s + (e.planned || 0), 0);
          const actual = records.filter((r) => r.machine === machine.id && r.date === todayStr).reduce((s, r) => s + (r.actual || 0), 0);
          const pct = planned > 0 ? Math.round((actual / planned) * 100) : null;
          const color = pct === null ? 'border-slate-700 bg-slate-800/30' :
            pct >= 95 ? 'border-emerald-500/30 bg-emerald-500/5' :
            pct >= 80 ? 'border-sky-500/30 bg-sky-500/5' :
            pct >= 65 ? 'border-amber-500/30 bg-amber-500/5' : 'border-red-500/30 bg-red-500/5';
          const dot = pct === null ? 'bg-slate-600' : pct >= 95 ? 'bg-emerald-400' : pct >= 80 ? 'bg-sky-400' : pct >= 65 ? 'bg-amber-400' : 'bg-red-400';
          return (
            <div key={machine.id} className={`border rounded-xl p-3 ${color} transition-all`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-300">{machine.id}</span>
                <span className={`w-2 h-2 rounded-full ${dot} ${pct !== null ? 'pulse-dot' : ''}`} />
              </div>
              <p className="text-[10px] text-slate-500 truncate">{machine.name}</p>
              {pct !== null ? (
                <p className="text-sm font-mono font-bold text-slate-200 mt-1">{pct}%</p>
              ) : (
                <p className="text-[10px] text-slate-600 mt-1">sem dados</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { factory, month, getYearMonth } = useAppStore();
  const { entries, setEntries } = usePlanningStore();
  const { records, setRecords } = useProductionStore();

  const machines = MACHINES[factory] || [];
  const yearMonth = getYearMonth();
  const days = getDaysInMonth(month.year, month.month);

  useEffect(() => {
    const unsubP = subscribePlanningEntries(factory, yearMonth, (data) => {
      if (data.length === 0) {
        const { entries: demo } = seedDemoData();
        setEntries(demo.filter((e) => e.factory === factory && e.date.startsWith(yearMonth)));
      } else setEntries(data);
    });
    const unsubR = subscribeProductionRecords(factory, yearMonth, (data) => {
      if (data.length === 0) {
        const { production: demo } = seedDemoData();
        setRecords(demo.filter((r) => r.factory === factory && r.date.startsWith(yearMonth)));
      } else setRecords(data);
    });
    return () => { unsubP(); unsubR(); };
  }, [factory, yearMonth]);

  const totalPlanned = entries.reduce((s, e) => s + (e.planned || 0), 0);
  const totalActual = records.reduce((s, r) => s + (r.actual || 0), 0);
  const adherence = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;
  const workingDays = days.filter((d) => !isSunday(d));
  const pastDays = workingDays.filter((d) => isPast(d) || isToday(d));

  // Daily chart data
  const chartData = useMemo(() => {
    return pastDays.slice(-15).map((date) => {
      const dayNum = parseInt(date.split('-')[2]);
      const planned = entries.filter((e) => e.date === date).reduce((s, e) => s + (e.planned || 0), 0);
      const actual = records.filter((r) => r.date === date).reduce((s, r) => s + (r.actual || 0), 0);
      return { day: dayNum, planned, actual };
    });
  }, [entries, records, pastDays]);

  // Product mix
  const productMix = useMemo(() => {
    const map = {};
    entries.forEach((e) => {
      if (!map[e.productName]) map[e.productName] = 0;
      map[e.productName] += e.planned || 0;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [entries]);

  const monthLabel = getMonthLabel(month.year, month.month);

  return (
    <div className="h-full overflow-auto p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5 capitalize">{monthLabel}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Planejado" value={totalPlanned >= 1000 ? `${(totalPlanned/1000).toFixed(0)}k` : totalPlanned} unit="kg" color="#0ea5e9" trend={0} sub={`${workingDays.length} dias úteis`} />
        <KpiCard label="Total Realizado" value={totalActual >= 1000 ? `${(totalActual/1000).toFixed(0)}k` : totalActual} unit="kg" color="#10b981" trend={totalActual >= totalPlanned * 0.9 ? 1 : -1} sub={`${pastDays.length} dias apurados`} />
        <KpiCard label="Aderência" value={`${adherence}%`} color={adherence >= 90 ? '#10b981' : adherence >= 80 ? '#f59e0b' : '#ef4444'} trend={adherence >= 90 ? 1 : -1} sub="planejado vs realizado" />
        <KpiCard label="Máquinas Ativas" value={machines.length} color="#8b5cf6" trend={0} sub={`${factory === 'doptex' ? 'Doptex' : 'Corradi'}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-brand-navy border border-white/[0.06] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Activity size={15} className="text-brand-doptex" /> Produção Diária (kg)
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barGap={2}>
                <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} width={40}
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#e2e8f0' }}
                  formatter={(v, name) => [`${v.toLocaleString('pt-BR')} kg`, name === 'planned' ? 'Planejado' : 'Realizado']}
                />
                <Bar dataKey="planned" fill="#0ea5e920" radius={[4,4,0,0]} />
                <Bar dataKey="actual" radius={[4,4,0,0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.actual >= entry.planned * 0.9 ? '#10b981' : entry.actual >= entry.planned * 0.75 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-600 text-sm">Sem dados para exibir</div>
          )}
        </div>

        {/* Product mix */}
        <div className="bg-brand-navy border border-white/[0.06] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Package size={15} className="text-brand-corradi" /> Mix de Produtos
          </h3>
          <div className="space-y-3">
            {productMix.length > 0 ? productMix.map(([name, val]) => {
              const pct = totalPlanned > 0 ? Math.round((val / totalPlanned) * 100) : 0;
              return (
                <div key={name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 font-medium">{name}</span>
                    <span className="text-slate-500 font-mono">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-brand-slate/60 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-corradi rounded-full transition-all duration-700"
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            }) : (
              <p className="text-slate-600 text-sm text-center py-8">Sem dados</p>
            )}
          </div>
        </div>
      </div>

      {/* Machine status */}
      <MachineStatusGrid machines={machines} entries={entries} records={records} factory={factory} />
    </div>
  );
}
