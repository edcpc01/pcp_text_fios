import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight, X, Save, Trash2 } from 'lucide-react';
import { useAppStore, usePlanningStore, useAdminStore, CELL_TYPES } from '../hooks/useStore';
import { subscribePlanningEntries, savePlanningEntry, deletePlanningEntry } from '../services/firebase';
import { getDaysInMonth, getWeekday, formatDate, getMonthLabel, isToday } from '../utils/dates';
import { seedDemoData } from '../utils/seedData';

// ─── Legend ──────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {Object.values(CELL_TYPES).map((t) => (
        <div key={t.id} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded" style={{ backgroundColor: t.color, opacity: 0.8 }} />
          <span className="text-xs text-brand-muted">{t.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Cell Type Selector ───────────────────────────────────────────────────────
function CellTypeMenu({ onSelect, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-brand-card border border-brand-border rounded-2xl p-2 shadow-2xl w-64 animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-semibold text-brand-muted uppercase tracking-wider px-2 py-1.5">Tipo de dia</p>
        {Object.values(CELL_TYPES).map((t) => (
          <button key={t.id} onClick={() => onSelect(t.id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: t.color }} />
            <span className="text-sm text-white">{t.label}</span>
          </button>
        ))}
        <div className="border-t border-brand-border mt-1 pt-1">
          <button onClick={() => onSelect(null)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/10 transition-colors text-left">
            <span className="w-3 h-3 rounded-sm bg-brand-muted/30" />
            <span className="text-sm text-brand-muted">Limpar célula</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Entry Modal (for Produção type) ─────────────────────────────────────────
function EntryModal({ entry, machine, date, factory, products, onSave, onDelete, onClose }) {
  const isEdit = !!entry?.id && !entry.id.startsWith('local-');
  const [form, setForm] = useState({
    machine:     entry?.machine     || machine?.id || '',
    machineName: entry?.machineName || machine?.name || '',
    product:     entry?.product     || products[0]?.id || '',
    productName: entry?.productName || products[0]?.name || '',
    date:        entry?.date || date || '',
    planned:     entry?.planned || (machine ? Math.round(machine.capacity * 0.8) : 400),
    quality:     entry?.quality || 'A',
    side:        entry?.side    || 'Lado A',
    cellType:    entry?.cellType || 'producao',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleProduct = (id) => {
    const p = products.find((p) => p.id === id);
    if (p) setForm((f) => ({ ...f, product: p.id, productName: p.name }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try { await onSave({ ...entry, ...form, factory }); onClose(); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await onDelete(entry.id); onClose(); }
    finally { setDeleting(false); }
  };

  const isProducao = form.cellType === 'producao';

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
            <label className="block text-xs font-semibold text-brand-muted mb-2 uppercase tracking-wider">Tipo de dia</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(CELL_TYPES).map((t) => (
                <button key={t.id} onClick={() => setForm((f) => ({ ...f, cellType: t.id }))}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all"
                  style={form.cellType === t.id
                    ? { background: t.bg, borderColor: t.border, color: t.text }
                    : { background: 'transparent', borderColor: 'rgba(30,48,88,1)', color: '#64748b' }}>
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: t.color }} />
                  <span className="text-xs leading-tight text-left">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {isProducao && (<>
            {/* Data */}
            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">Data</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-cyan/50 transition-all" />
            </div>

            {/* Produto */}
            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">Produto</label>
              <select value={form.product} onChange={(e) => handleProduct(e.target.value)}
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-cyan/50 transition-all">
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Prod + Lado + Qualidade */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">Kg/dia</label>
                <input type="number" value={form.planned} min={0} max={9999}
                  onChange={(e) => setForm((f) => ({ ...f, planned: Number(e.target.value) }))}
                  className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-brand-cyan/50 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">Lado</label>
                <select value={form.side} onChange={(e) => setForm((f) => ({ ...f, side: e.target.value }))}
                  className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-cyan/50 transition-all">
                  <option>Lado A</option><option>Lado B</option><option>Único</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">Qual.</label>
                <select value={form.quality} onChange={(e) => setForm((f) => ({ ...f, quality: e.target.value }))}
                  className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-cyan/50 transition-all">
                  <option value="A">A</option><option value="B">B</option>
                </select>
              </div>
            </div>
          </>)}

          {!isProducao && (
            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">Data</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-cyan/50 transition-all" />
              <p className="text-xs text-brand-muted mt-2">Nenhuma produção será apontada para este dia.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 pb-5 pt-1">
          {isEdit && (
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-40">
              <Trash2 size={12} /> {deleting ? 'Removendo...' : 'Remover'}
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-xs text-brand-muted hover:text-white transition-colors rounded-xl">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving || !form.date}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/30 text-brand-cyan text-xs font-semibold rounded-xl transition-all disabled:opacity-40">
            <Save size={12} /> {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Matrix Cell ──────────────────────────────────────────────────────────────
function MatrixCell({ entry, date, machine, isToday: today, onClick }) {
  const ct = entry?.cellType ? CELL_TYPES[entry.cellType] : null;
  const isProducao = entry?.cellType === 'producao';

  return (
    <td onClick={() => onClick(entry, machine, date)}
      className="border border-brand-border/50 min-w-[56px] w-[56px] cursor-pointer transition-all duration-100 hover:brightness-125"
      style={ct ? { background: ct.bg, borderColor: ct.border } : { background: today ? 'rgba(34,211,238,0.05)' : 'transparent' }}>
      <div className="h-[52px] flex flex-col items-center justify-center gap-0.5 px-1">
        {entry ? (
          isProducao ? (
            <>
              <span className="text-[11px] font-mono font-bold leading-none" style={{ color: ct.text }}>
                {entry.planned >= 1000 ? `${(entry.planned/1000).toFixed(1)}k` : entry.planned}
              </span>
              <span className="text-[9px] font-medium" style={{ color: ct.text, opacity: 0.7 }}>{entry.quality}</span>
            </>
          ) : (
            <span className="text-[8px] font-bold uppercase tracking-wide text-center leading-tight px-0.5"
              style={{ color: ct.text, opacity: 0.9 }}>
              {ct.label.split(' ').slice(0, 2).join(' ')}
            </span>
          )
        ) : (
          <Plus size={10} className="text-brand-border opacity-60" />
        )}
      </div>
    </td>
  );
}

// ─── Planning Page ────────────────────────────────────────────────────────────
export default function Planning() {
  const { factory, month, changeMonth, getYearMonth } = useAppStore();
  const { entries, setEntries, setLoading, addEntry, updateEntry, deleteEntry } = usePlanningStore();
  const { products, machines } = useAdminStore();

  const [modal, setModal] = useState(null);
  const machineList = machines[factory] || [];
  const days = getDaysInMonth(month.year, month.month);
  const yearMonth = getYearMonth();
  const monthLabel = getMonthLabel(month.year, month.month);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribePlanningEntries(factory, yearMonth, (data) => {
      if (data.length === 0) {
        const { entries: demo } = seedDemoData();
        setEntries(demo.filter((e) => e.factory === factory && e.date?.startsWith(yearMonth)));
      } else setEntries(data);
    });
    return () => unsub();
  }, [factory, yearMonth]);

  // Map machine+date → entry
  const entryMap = {};
  entries.forEach((e) => { entryMap[`${e.machine}-${e.date}`] = e; });

  // Totals
  const machineTotals = {};
  machineList.forEach((m) => {
    machineTotals[m.id] = entries.filter((e) => e.machine === m.id && e.cellType === 'producao').reduce((s, e) => s + (e.planned || 0), 0);
  });
  const grandTotal = Object.values(machineTotals).reduce((s, v) => s + v, 0);

  const handleSave = useCallback(async (data) => {
    try {
      const id = await savePlanningEntry({ ...data });
      if (data.id && !data.id.startsWith('local-')) updateEntry(data.id, { ...data, id });
      else addEntry({ ...data, id });
    } catch { addEntry({ ...data, id: `local-${Date.now()}` }); }
  }, [addEntry, updateEntry]);

  const handleDelete = useCallback(async (id) => {
    try { await deletePlanningEntry(id); } catch {}
    deleteEntry(id);
  }, [deleteEntry]);

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border bg-brand-surface/50 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-white">Planejamento</h1>
          <p className="text-xs text-brand-muted capitalize mt-0.5">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <Legend />
          {/* Month nav */}
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

      {/* KPIs */}
      <div className="px-6 py-2.5 flex items-center gap-6 border-b border-brand-border/50 shrink-0 bg-brand-surface/30">
        {[
          { label: 'Total planejado', value: `${grandTotal.toLocaleString('pt-BR')} kg` },
          { label: 'Máquinas', value: machineList.length },
          { label: 'Dias no mês', value: days.length },
          { label: 'Entradas', value: entries.length },
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
              <th className="sticky left-0 z-20 bg-brand-bg border border-brand-border/50 px-4 py-3 text-left min-w-[130px]">
                <span className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider">Máquina</span>
              </th>
              {days.map((date) => {
                const today = isToday(date);
                const dayNum = date.split('-')[2];
                const wd = getWeekday(date);
                const isSun = new Date(date + 'T12:00:00').getDay() === 0;
                return (
                  <th key={date} className="border border-brand-border/50 min-w-[56px] w-[56px] py-2 px-1 text-center"
                    style={today ? { background: 'rgba(34,211,238,0.05)', borderColor: 'rgba(34,211,238,0.2)' } : {}}>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={`text-[9px] font-medium uppercase ${isSun ? 'text-red-400' : 'text-brand-muted'}`}>{wd}</span>
                      <span className={`text-[11px] font-mono font-bold ${today ? 'text-brand-cyan' : isSun ? 'text-red-400/70' : 'text-brand-muted'}`}>{dayNum}</span>
                    </div>
                  </th>
                );
              })}
              <th className="sticky right-0 z-20 bg-brand-bg border border-brand-border/50 px-3 py-3 min-w-[80px] text-right">
                <span className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider">Total</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {machineList.map((machine) => (
              <tr key={machine.id} className="group hover:bg-white/[0.01]">
                <td className="sticky left-0 z-10 bg-brand-bg group-hover:bg-brand-surface/30 border border-brand-border/50 px-4 py-0 transition-colors">
                  <div className="py-1.5">
                    <span className="text-xs font-bold text-white">{machine.id}</span>
                    <span className="text-[10px] text-brand-muted block">{machine.name}</span>
                  </div>
                </td>
                {days.map((date) => (
                  <MatrixCell key={date} entry={entryMap[`${machine.id}-${date}`]} date={date} machine={machine}
                    isToday={isToday(date)} onClick={(entry, m, d) => setModal({ entry: entry || null, machine: m, date: d })} />
                ))}
                <td className="sticky right-0 z-10 bg-brand-bg group-hover:bg-brand-surface/30 border border-brand-border/50 px-3 transition-colors text-right">
                  <span className="text-xs font-mono font-bold text-brand-cyan">{(machineTotals[machine.id] || 0).toLocaleString('pt-BR')}</span>
                  <span className="text-[10px] text-brand-muted ml-0.5">kg</span>
                </td>
              </tr>
            ))}
            {/* Total row */}
            <tr className="border-t-2 border-brand-border">
              <td className="sticky left-0 z-10 bg-brand-surface border border-brand-border/50 px-4 py-2">
                <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">Total</span>
              </td>
              {days.map((date) => {
                const dayTotal = machineList.reduce((s, m) => {
                  const e = entryMap[`${m.id}-${date}`];
                  return s + (e?.cellType === 'producao' ? (e.planned || 0) : 0);
                }, 0);
                return (
                  <td key={date} className="border border-brand-border/50 bg-brand-surface text-center"
                    style={isToday(date) ? { background: 'rgba(34,211,238,0.05)' } : {}}>
                    <span className="text-[10px] font-mono text-brand-muted">
                      {dayTotal > 0 ? (dayTotal >= 1000 ? `${(dayTotal/1000).toFixed(1)}k` : dayTotal) : '—'}
                    </span>
                  </td>
                );
              })}
              <td className="sticky right-0 z-10 bg-brand-surface border border-brand-border/50 px-3 text-right">
                <span className="text-sm font-mono font-bold text-brand-cyan">{grandTotal.toLocaleString('pt-BR')}</span>
                <span className="text-[10px] text-brand-muted ml-0.5">kg</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {modal && (
        <EntryModal entry={modal.entry} machine={modal.machine} date={modal.date}
          factory={factory} products={products}
          onSave={handleSave} onDelete={handleDelete} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
