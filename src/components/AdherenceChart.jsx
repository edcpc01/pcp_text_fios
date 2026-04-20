import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { fetchMonthSummary } from '../services/firebase';
import { getMonthLabel } from '../utils/dates';

// Gera array dos últimos N meses (excluindo o mês atual)
function getPastMonths(n) {
  const result = [];
  const now = new Date();
  for (let i = n; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    result.push(ym);
  }
  return result;
}

function fmtKg(v) {
  if (v == null) return '—';
  return v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${Math.round(v)} kg`;
}

// Tooltip customizado
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-brand-card border border-brand-border rounded-xl px-4 py-3 shadow-xl text-xs space-y-1.5">
      <p className="font-bold text-white capitalize">{d?.monthLabel}</p>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-brand-cyan shrink-0" />
        <span className="text-brand-muted">Aderência:</span>
        <span className="font-mono font-bold" style={{ color: d?.color }}>{d?.adherence != null ? `${d.adherence}%` : '—'}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
        <span className="text-brand-muted">Planejado:</span>
        <span className="font-mono text-white">{fmtKg(d?.totalPlanned)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
        <span className="text-brand-muted">Realizado:</span>
        <span className="font-mono text-white">{fmtKg(d?.totalActual)}</span>
      </div>
    </div>
  );
}

export default function AdherenceChart({ factory, currentAdherence, currentMonth }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const months = getPastMonths(5); // últimos 5 meses

    Promise.all(months.map((ym) => fetchMonthSummary(factory, ym)))
      .then((results) => {
        if (cancelled) return;
        const data = results.map((r) => ({
          ...r,
          monthLabel: getMonthLabel(Number(r.yearMonth.split('-')[0]), Number(r.yearMonth.split('-')[1]) - 1),
          shortLabel: new Date(Number(r.yearMonth.split('-')[0]), Number(r.yearMonth.split('-')[1]) - 1, 1)
            .toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
          color: r.adherence == null ? '#64748b' : r.adherence >= 90 ? '#10b981' : r.adherence >= 80 ? '#f59e0b' : '#ef4444',
        }));

        // Adiciona mês atual
        const curLabel = getMonthLabel(
          Number(currentMonth.split('-')[0]),
          Number(currentMonth.split('-')[1]) - 1,
        );
        const curShort = new Date(Number(currentMonth.split('-')[0]), Number(currentMonth.split('-')[1]) - 1, 1)
          .toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        data.push({
          yearMonth: currentMonth,
          monthLabel: curLabel,
          shortLabel: curShort,
          adherence: currentAdherence,
          totalPlanned: null,
          totalActual: null,
          isCurrent: true,
          color: currentAdherence >= 90 ? '#10b981' : currentAdherence >= 80 ? '#f59e0b' : '#ef4444',
        });

        setHistory(data);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [factory, currentMonth]);

  // Atualiza aderência do mês atual em tempo real sem re-fetch histórico
  useEffect(() => {
    setHistory((prev) => prev.map((d) =>
      d.isCurrent
        ? { ...d, adherence: currentAdherence, color: currentAdherence >= 90 ? '#10b981' : currentAdherence >= 80 ? '#f59e0b' : '#ef4444' }
        : d,
    ));
  }, [currentAdherence]);

  const hasData = history.some((d) => d.adherence != null);

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-4 sm:p-5"
      style={{ borderTop: '2px solid #10b981' }}>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-brand-muted uppercase tracking-widest flex items-center gap-2">
          <TrendingUp size={13} className="text-brand-success" /> Aderência Histórica
        </h3>
        <div className="flex items-center gap-3 text-[10px] text-brand-muted">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> ≥ 90%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 80–90%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> &lt; 80%</span>
        </div>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <span className="text-brand-muted text-sm animate-pulse">Carregando histórico…</span>
        </div>
      ) : !hasData ? (
        <div className="h-48 flex items-center justify-center">
          <span className="text-brand-muted text-sm">Sem dados históricos</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={history} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="shortLabel"
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 130]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              ticks={[0, 50, 80, 90, 100, 110, 130]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
            {/* Linha de meta 90% */}
            <ReferenceLine y={90} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.4}
              label={{ value: '90%', fill: '#10b981', fontSize: 10, position: 'insideTopRight' }} />
            <Line
              type="monotone"
              dataKey="adherence"
              stroke="#06b6d4"
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (payload.adherence == null) return null;
                return (
                  <circle
                    key={payload.yearMonth}
                    cx={cx} cy={cy} r={payload.isCurrent ? 5 : 4}
                    fill={payload.color}
                    stroke={payload.isCurrent ? '#fff' : payload.color}
                    strokeWidth={payload.isCurrent ? 2 : 0}
                  />
                );
              }}
              activeDot={{ r: 6, fill: '#06b6d4', stroke: '#fff', strokeWidth: 2 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
