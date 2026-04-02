import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight, X, Save, Trash2 } from 'lucide-react';
import { useAppStore, usePlanningStore, useAdminStore, CELL_TYPES } from '../hooks/useStore';
import { subscribePlanningEntries, savePlanningEntry, deletePlanningEntry } from '../services/firebase';
import { getDaysInMonth, getWeekday, formatDate, getMonthLabel, isToday } from '../utils/dates';
import { seedDemoData } from '../utils/seedData';

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {Object.values(CELL_TYPES).map((t) => (
        <div key={t.id} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: t.color }} />
          <span className="text-xs text-brand-muted">{t.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Entry Modal ──────────────────────────────────────────────────────────────
function EntryModal({ entry, machine, date, factory, products, machines, onSave, onDelete, onClose }) {
  const isEdit = !!entry?.id && !entry.id.startsWith('local-');
  const [form, setForm] = useState({
    machine:     entry?.machine     || machine?.id    || '',
    machineName: entry?.machineName || machine?.name  || '',
    product:     entry?.product     || products[0]?.id  || '',
    productName: entry?.productName || products[0]?.name || '',
    date:        entry?.date || date || '',
    planned:     entry?.planned || (machine ? Math.round(machine.capacity * 0.8) : 400),
    quality:     entry?.quality  || 'A',
    side:        entry?.side     || 'Lado A',
    cellType:    entry?.cellType || 'producao',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleProduct = (id) => {
    const p = products.find((p) => p.id === id);
    if (p) setForm((f) => ({ ...f, product: p.id, productName: p.name }));
  };

  const handleMachine = (id) => {
    const m = machines?.find((m) => m.id === id);
    if (m) setForm((f) => ({ ...f, machine: m.id, machineName: m.name, planned: Math.round(m.capacity * 0.8) }));
  };

  const isProducao = form.cellType === 'producao';

  const handleSubmit = async () => {
    if (!form.date || !form.machine) return;
    setSaving(true);
    try { await onSave({ ...entry, ...form, factory }); onClose(); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete(entry.id); onClose(); }
    finally { setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-brand-card border border-brand-border rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-brand-border">
          <div>
            <h3 className="text-sm font-semibold text-white">{isEdit ? 'Editar' : 'Novo'} Planejamento</h3>
            {form.date && <p className="text-xs text-brand-muted mt-0.5">{formatDate(form.date)} · {form.machineName}</p>}
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-white p-1 rounded-lg transition-colors"><X size={15} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Tipo de dia */}
          <div>
            <label className="block text-xs font-bold text-brand-muted mb-2 uppercase tracking-wider">Tipo de dia</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(CELL_TYPES).map((t) => (
                <button key={t.id} onClick={() => setForm((f) => ({ ...f, cellType: t.id }))}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs transition-all text-left"
                  style={form.cellType === t.id
                    ? { background: t.bg, borderColor: t.border, color: t.text }
                    : { background: 'transparent', borderColor: '#1e3058', color: '#64748b' }}>
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: t.color }} />
                  <span className="leading-tight">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Data + Máquina */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-brand-muted mb-1.5 uppercase tracking-wider">Data</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-cyan/50 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-bold text-brand-muted mb-1.5 uppercase tracking-wider">Máquina</label>
              <select value={form.machine} onChange={(e) => handleMachine(e.target.value)}
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-cyan/50 transition-all">
                {machines?.map((m) => <option key={m.id} value={m.id}>{m.id} — {m.name}</option>)}
              </select>
            </div>
          </div>

          {isProducao && (<>
            {/* Produto */}
            <div>
              <label className="block text-xs font-bold text-brand-muted mb-1.5 uppercase tracking-wider">Produto</label>
              <select value={form.product} onChange={(e) => handleProduct(e.target.value)}
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-cyan/50 transition-all">
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {/* Prod + Lado + Qualidade */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-brand-muted mb-1.5 uppercase tracking-wider">Kg/dia</label>
                <input type="number" value={form.planned} min={0} max={9999}
                  onChange={(e) => setForm((f) => ({ ...f, planned: Number(e.target.value) }))}
                  className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-brand-cyan/50 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-muted mb-1.5 uppercase tracking-wider">Lado</label>
                <select value={form.side} onChange={(e) => setForm((f) => ({ ...f, side: e.target.value }))}
                  className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-cyan/50 transition-all">
                  <option>Lado A</option><option>Lado B</option><option>Único</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-muted mb-1.5 uppercase tracking-wider">Qual.</label>
                <select value={form.quality} onChange={(e) => setForm((f) => ({ ...f, quality: e.target.value }))}
                  className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-cyan/50 transition-all">
                  <option value="A">A</option><option value="B">B</option>
                </select>
              </div>
            </div>
          </>)}

          {!isProducao && (
            <p className="text-xs text-brand-muted bg-brand-surface/50 border border-brand-border rounded-xl px-3 py-2.5">
              Nenhuma produção será apontada para este dia.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 pb-5 pt-1">
          {isEdit && (
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-40">
              <Trash2 size={12} />{deleting ? 'Removendo...' : 'Remover'}
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-xs text-brand-muted hover:text-white transition-colors rounded-xl">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving || !form.date || !form.machine}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/30 text-brand-cyan text-xs font-semibold rounded-xl transition-all disabled:opacity-40">
            <Save size={12} />{saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Matrix Cell ──────────────────────────────────────────────────────────────
function MatrixCell({ entry, date, machine, isCurrentDay, onClick }) {
  const ct = entry?.cellType ? CELL_TYPES[entry.cellType] : null;

  return (
    <td onClick={() => onClick(entry, machine, date)}
      className="border border-brand-border/40 min-w-[56px] w-[56px] cursor-pointer transition-all duration-100 hover:brightness-125"
      style={ct
        ? { background: ct.bg, borderColor: ct.border }
        : { background: isCurrentDay ? 'rgba(34,211,238,0.04)' : 'transparent' }}>
      <div className="h-[52px] flex flex-col items-center justify-center gap-0.5 px-1">
        {entry ? (
          entry.cellType === 'producao' ? (
            <>
              <span className="text-[11px] font-mono font-bold leading-none" style={{ color: ct.text }}>
                {entry.planned >= 1000 ? `${(entry.planned / 1000).toFixed(1)}k` : entry.planned}
              </span>
              <span className="text-[9px] font-medium" style={{ color: ct.text, opacity: 0.7 }}>{entry.quality}</span>
            </>
          ) : (
            <span className="text-[8px] font-bold uppercase tracking-wide text-center leading-tight px-0.5"
              style={{ color: ct.text, opacity: 0.85 }}>
              {entry.cellType === 'parada_np'  ? 'P.N.P' :
               entry.cellType === 'parada_p'   ? 'P.Prog' :
               entry.cellType === 'manutencao' ? 'Manut.' : ''}
            </span>
          )
        ) : (
          <Plus size={9} className="text-brand-border/80" />
        )}
      </div>
    </td>
  );
}

// ─── Planning Page ────────────────────────────────────────────────────────────
export default function Planning() {
  const { factory, month, changeMonth, getYearMonth } = useAppStore();
  const { entries, setEntries, setLoading, addEntry, updateEntry, deleteEntry } = usePlanningStore();
  const { products, machines: adminMachines } = useAdminStore();

  const [modal, setModal] = useState(null);
  const machineList = adminMachines[factory] || [];
  const days        = getDaysInMonth(month.year, month.month);
  const yearMonth   = getYearMonth();
  const monthLabel  = getMonthLabel(month.year, month.month);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribePlanningEntries(factory, yearMonth, (data) => {
      if (data.length === 0) {
        const { entries: demo } = seedDemoData();
        setEntries(demo.filter((e) => e.factory === factory && e.date?.startsWith(yearMonth)));
      } else {
        setEntries(data);
      }
    });
    return () => unsub();
  }, [factory, yearMonth]);

  // Build entryMap: machine+date → entry (last write wins — no accumulation)
  const entryMap = {};
  entries.forEach((e) => {
    const key = `${e.machine}-${e.date}`;
    // If multiple entries exist for same slot, keep the most recently updated
    if (!entryMap[key] || (e.updatedAt > (entryMap[key].updatedAt || ''))) {
      entryMap[key] = e;
    }
  });

  // Totals — only 'producao' type counts
  const machineTotals = {};
  machineList.forEach((m) => {
    const seen = new Set();
    machineTotals[m.id] = entries
      .filter((e) => {
        if (e.machine !== m.id || e.cellType !== 'producao') return false;
        // Deduplicate by date (take first occurrence after sort)
        if (seen.has(e.date)) return false;
        seen.add(e.date);
        return true;
      })
      .reduce((s, e) => s + (e.planned || 0), 0);
  });
  const grandTotal = Object.values(machineTotals).reduce((s, v) => s + v, 0);

  const handleSave = useCallback(async (data) => {
    try {
      const savedId = await savePlanningEntry(data);
      const saved = { ...data, id: savedId };
      // Find if there's already an entry for this machine+date in store
      const existing = entries.find(
        (e) => e.machine === data.machine && e.date === data.date && e.side === data.side
      );
      if (existing) {
        updateEntry(existing.id, saved);
      } else {
        addEntry(saved);
      }
    } catch (err) {
      console.error(err);
      addEntry({ ...data, id: `local-${Date.now()}` });
    }
  }, [entries, addEntry, updateEntry]);

  const handleDelete = useCallback(async (id) => {
    try { await deletePlanningEntry(id); } catch (err) { console.error(err); }
    deleteEntry(id);
  }, [deleteEntry]);

  return (
    <div className="flex flex-col h-full min-h-0" style={{ height: 'calc(100vh - 56px)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border bg-brand-surface/30 shrink-0 flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Planejamento</h1>
          <p className="text-xs text-brand-muted capitalize mt-0.5">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Legend />
          <div className="flex items-center gap-1 bg-brand-card border border-brand-border rounded-xl p-1">
            <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-brand-muted hover:text-white"><ChevronLeft size={13} /></button>
            <span className="text-xs font-medium text-white px-2 min-w-[72px] text-center capitalize">
              {new Date(month.year, month.month).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
            </span>
            <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-brand-muted hover:text-white"><ChevronRight size={13} /></button>
          </div>
          <button onClick={() => setModal({ entry: null, machine: null, date: new Date().toISOString().split('T')[0] })}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-cyan/10 hover:bg-brand-cyan/15 border border-brand-cyan/30 text-brand-cyan text-xs font-semibold rounded-xl transition-all">
            <Plus size={13} /> Nova entrada
          </button>
        </div>
      </div>

      {/* KPI bar */}
      <div className="px-6 py-2.5 flex items-center gap-6 border-b border-brand-border/40 shrink-0 flex-wrap">
        {[
          { label: 'Total planejado', value: `${grandTotal.toLocaleString('pt-BR')} kg` },
          { label: 'Máquinas',        value: machineList.length },
          { label: 'Dias no mês',     value: days.length },
          { label: 'Entradas',        value: Object.keys(entryMap).length },
        ].map((k) => (
          <div key={k.label}>
            <p className="text-[10px] text-brand-muted uppercase tracking-wider">{k.label}</p>
            <p className="text-sm font-mono font-bold text-white">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Matrix */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse w-max min-w-full">
          <thead>
            <tr className="sticky top-0 z-10 bg-brand-bg/95 backdrop-blur-sm">
              <th className="sticky left-0 z-20 bg-brand-bg border border-brand-border/40 px-4 py-3 text-left min-w-[130px]">
                <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Máquina</span>
              </th>
              {days.map((date) => {
                const today  = isToday(date);
                const dayNum = date.split('-')[2];
                const wd     = getWeekday(date);
                const isSun  = new Date(date + 'T12:00:00').getDay() === 0;
                return (
                  <th key={date} className="border border-brand-border/40 min-w-[56px] w-[56px] py-2 px-0.5 text-center"
                    style={today ? { background: 'rgba(34,211,238,0.06)', borderColor: 'rgba(34,211,238,0.25)' } : {}}>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={`text-[9px] font-medium uppercase ${isSun ? 'text-red-400/80' : 'text-brand-muted'}`}>{wd}</span>
                      <span className={`text-[11px] font-mono font-bold ${today ? 'text-brand-cyan' : isSun ? 'text-red-400/60' : 'text-brand-muted'}`}>{dayNum}</span>
                    </div>
                  </th>
                );
              })}
              <th className="sticky right-0 z-20 bg-brand-bg border border-brand-border/40 px-3 py-3 min-w-[80px] text-right">
                <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Total</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {machineList.map((machine) => (
              <tr key={machine.id} className="group hover:bg-white/[0.01]">
                <td className="sticky left-0 z-10 bg-brand-bg group-hover:bg-brand-surface/20 border border-brand-border/40 px-4 py-0 transition-colors">
                  <div className="py-2">
                    <span className="text-xs font-bold text-white block">{machine.id}</span>
                    <span className="text-[10px] text-brand-muted">{machine.name}</span>
                  </div>
                </td>
                {days.map((date) => (
                  <MatrixCell
                    key={date}
                    entry={entryMap[`${machine.id}-${date}`]}
                    date={date}
                    machine={machine}
                    isCurrentDay={isToday(date)}
                    onClick={(entry, m, d) => setModal({ entry: entry || null, machine: m, date: d })}
                  />
                ))}
                <td className="sticky right-0 z-10 bg-brand-bg group-hover:bg-brand-surface/20 border border-brand-border/40 px-3 transition-colors text-right">
                  <span className="text-xs font-mono font-bold text-brand-cyan">
                    {(machineTotals[machine.id] || 0).toLocaleString('pt-BR')}
                  </span>
                  <span className="text-[10px] text-brand-muted ml-0.5">kg</span>
                </td>
              </tr>
            ))}
            {/* Total row */}
            <tr className="border-t-2 border-brand-border">
              <td className="sticky left-0 z-10 bg-brand-surface border border-brand-border/40 px-4 py-2.5">
                <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Total</span>
              </td>
              {days.map((date) => {
                const seen = new Set();
                const dayTotal = machineList.reduce((s, m) => {
                  const e = entryMap[`${m.id}-${date}`];
                  if (!e || e.cellType !== 'producao') return s;
                  if (seen.has(`${m.id}-${date}`)) return s;
                  seen.add(`${m.id}-${date}`);
                  return s + (e.planned || 0);
                }, 0);
                return (
                  <td key={date} className="border border-brand-border/40 bg-brand-surface text-center"
                    style={isToday(date) ? { background: 'rgba(34,211,238,0.04)' } : {}}>
                    <span className="text-[10px] font-mono text-brand-muted">
                      {dayTotal > 0 ? (dayTotal >= 1000 ? `${(dayTotal / 1000).toFixed(1)}k` : dayTotal) : '—'}
                    </span>
                  </td>
                );
              })}
              <td className="sticky right-0 z-10 bg-brand-surface border border-brand-border/40 px-3 text-right">
                <span className="text-sm font-mono font-bold text-brand-cyan">{grandTotal.toLocaleString('pt-BR')}</span>
                <span className="text-[10px] text-brand-muted ml-0.5">kg</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {modal && (
        <EntryModal
          entry={modal.entry}
          machine={modal.machine}
          date={modal.date}
          factory={factory}
          products={products}
          machines={machineList}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
