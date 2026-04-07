import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight, X, Save, Trash2, CalendarDays, Package, Cpu, Activity } from 'lucide-react';
import { useAppStore, usePlanningStore, useAdminStore, useAuthStore, CELL_TYPES, makeEntryId, FACTORIES } from '../hooks/useStore';
import { subscribePlanningEntries, savePlanningEntry, deletePlanningEntry } from '../services/firebase';
import { getDaysInMonth, getWeekday, formatDate, getMonthLabel, isToday } from '../utils/dates';

// ─── Legend ───────────────────────────────────────────────────────────────────
function Legend() {
  return (
    <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-0.5 max-w-full md:max-w-none">
      {Object.values(CELL_TYPES).map((t) => (
        <div key={t.id} className="flex items-center gap-1.5 shrink-0">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: t.color }} />
          <span className="text-[10px] md:text-xs text-brand-muted whitespace-nowrap">{t.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Entry Modal ──────────────────────────────────────────────────────────────
function EntryModal({ entry, machine, date, factory, products, machines, onSave, onDelete, onClose }) {
  const isEdit = !!entry;
  const defaultProduct = products[0];
  const initialPlanned = entry?.planned ?? (
    (machine && defaultProduct && machine.spindles)
      ? Math.round(machine.spindles * (defaultProduct.prodDiaPosicao || 0) * ((machine.efficiency || 95) / 100))
      : (machine?.capacity ? Math.round(machine.capacity * 0.8) : 400)
  );

  const [form, setForm] = useState({
    machine:     entry?.machine     || machine?.id    || '',
    machineName: entry?.machineName || machine?.name  || '',
    product:     entry?.product     || defaultProduct?.id   || '',
    productName: entry?.productName || defaultProduct?.nome || '',
    date:        entry?.date || date || '',
    planned:     initialPlanned,
    cellType:    entry?.cellType || 'producao',
  });

  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Recalculate kg when product or machine changes
  const recalc = (m, p) => {
    if (m?.spindles && m?.efficiency && p?.prodDiaPosicao)
      return Math.round(m.spindles * p.prodDiaPosicao * (m.efficiency / 100));
    if (m?.capacity) return Math.round(m.capacity * 0.8);
    return form.planned;
  };

  const handleProduct = (id) => {
    const p = products.find((x) => x.id === id);
    const m = machines?.find((x) => x.id === form.machine);
    if (p) setForm((f) => ({ ...f, product: p.id, productName: p.nome, planned: recalc(m, p) }));
  };

  const handleMachine = (id) => {
    const m = machines?.find((x) => x.id === id);
    const p = products.find((x) => x.id === form.product);
    if (m) setForm((f) => ({ ...f, machine: m.id, machineName: m.name, planned: recalc(m, p) }));
  };

  const isProducao = form.cellType === 'producao';

  const handleSubmit = async () => {
    if (!form.date || !form.machine) return;
    setSaving(true);
    try { await onSave({ ...form, factory }); onClose(); }
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
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-brand-border">
          <div>
            <h3 className="text-sm font-semibold text-white">{isEdit ? 'Editar' : 'Novo'} Planejamento</h3>
            {form.date && <p className="text-xs text-brand-muted mt-0.5">{formatDate(form.date)} · {form.machineName}</p>}
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-white p-1 rounded-lg"><X size={15} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
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
            <div>
              <label className="block text-xs font-bold text-brand-muted mb-1.5 uppercase tracking-wider">Produto</label>
              <select value={form.product} onChange={(e) => handleProduct(e.target.value)}
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-cyan/50 transition-all">
                {products.map((p) => <option key={p.id} value={p.id}>{p.id} — {p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-brand-muted mb-1.5 uppercase tracking-wider">Kg/dia</label>
              <input type="number" value={form.planned} min={0} max={99999}
                onChange={(e) => setForm((f) => ({ ...f, planned: Number(e.target.value) }))}
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-brand-cyan/50 transition-all" />
            </div>
          </>)}

          {!isProducao && (
            <p className="text-xs text-brand-muted bg-brand-surface/50 border border-brand-border rounded-xl px-3 py-2.5">
              Nenhuma produção será apontada para este dia.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 pb-5 pt-1">
          {isEdit && (
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-40">
              <Trash2 size={12} />{deleting ? 'Removendo...' : 'Remover'}
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 text-xs text-brand-muted hover:text-white rounded-xl">Cancelar</button>
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
function MatrixCell({ entry, date, machine, isCurrentDay, onClick, onDragStart, onDrop }) {
  const ct = entry?.cellType ? CELL_TYPES[entry.cellType] : null;
  const tooltipText = entry
    ? (entry.cellType === 'producao' ? `${entry.productName || ''}\n${entry.planned} kg` : ct?.label)
    : 'Planejar dia';

  return (
    <td
      onClick={() => onClick && onClick(entry || null, machine, date)}
      title={tooltipText}
      draggable={!!entry && !!onDragStart}
      onDragStart={(e) => onDragStart && onDragStart(e, entry)}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={(e) => onDrop && onDrop(e, machine, date)}
      className={`border border-brand-border/40 min-w-[40px] md:min-w-[50px] w-[40px] md:w-[50px] transition-all duration-100 ${onClick ? 'cursor-pointer hover:brightness-125' : ''}`}
      style={ct
        ? { background: ct.bg, borderColor: ct.border }
        : { background: isCurrentDay ? 'rgba(34,211,238,0.04)' : 'transparent' }}>
      <div className="h-[40px] md:h-[52px] flex flex-col items-center justify-center gap-0.5 px-0.5">
        {entry ? (
          entry.cellType === 'producao' ? (<>
            <span className="text-[8px] md:text-[11px] font-mono font-black leading-none" style={{ color: ct.text }}>
              {entry.planned >= 1000 ? `${(entry.planned / 1000).toFixed(1)}k` : entry.planned}
            </span>
            <span className="text-[7px] md:text-[9px] font-bold" style={{ color: ct.text, opacity: 0.8 }}>{entry.quality || 'A'}</span>
          </>) : (
            <span className="text-[7px] md:text-[8px] font-black uppercase text-center leading-tight px-0.5" style={{ color: ct.text, opacity: 0.9 }}>
              {entry.cellType === 'parada_np' ? 'P.N.P' : entry.cellType === 'parada_p' ? 'P.Prog' : 'Manut.'}
            </span>
          )
        ) : (
          onClick ? <Plus size={8} className="text-brand-border/40 md:hidden" /> : null
        )}
      </div>
    </td>
  );
}

// ─── Machine row separator for "all" view ────────────────────────────────────
function FactoryDivider({ label, color }) {
  return (
    <tr>
      <td colSpan={999} className="px-4 py-1.5 bg-brand-surface/40 border-y border-brand-border/60">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{label}</span>
        </div>
      </td>
    </tr>
  );
}

// ─── Planning Page ────────────────────────────────────────────────────────────
export default function Planning() {
  const { user } = useAuthStore();
  const { factory, month, changeMonth, getYearMonth } = useAppStore();
  const { entriesMap, setEntriesFromArray, upsertEntry, deleteEntry, setLoading } = usePlanningStore();
  const { machines: adminMachines, products } = useAdminStore();

  const isSupervisor = user?.role === 'supervisor';
  const isAllUnits   = factory === 'all';

  const [modal, setModal] = useState(null);

  // When "all", show all machines from both factories with their real factory prefix
  // Each machine carries a `factory` property so we can look up the right entry
  const machineList = isAllUnits
    ? [
        ...(adminMachines.matriz || []).map((m) => ({ ...m, _factory: 'matriz' })),
        ...(adminMachines.filial || []).map((m) => ({ ...m, _factory: 'filial' })),
      ]
    : (adminMachines[factory] || []).map((m) => ({ ...m, _factory: factory }));

  const days      = getDaysInMonth(month.year, month.month);
  const yearMonth = getYearMonth();
  const monthLabel = getMonthLabel(month.year, month.month);

  // Subscribe — handles 'all' internally in firebase.js (merges both factories)
  useEffect(() => {
    setLoading(true);
    const unsub = subscribePlanningEntries(factory, yearMonth, (data) => {
      setEntriesFromArray(data);
    });
    return () => unsub();
  }, [factory, yearMonth]);

  // KEY FIX: use machine._factory (actual factory) not the selected factory
  // This way "all" view correctly finds entries stored as "matriz__M01__date"
  const getEntry = (machine, date) => {
    const f = machine._factory || factory;
    return entriesMap[makeEntryId(f, machine.id, date)] || null;
  };

  // Totals
  const machineTotals = {};
  machineList.forEach((m) => {
    let total = 0;
    days.forEach((date) => {
      const e = getEntry(m, date);
      if (e?.cellType === 'producao') total += e.planned || 0;
    });
    machineTotals[m.id] = total;
  });
  const grandTotal = Object.values(machineTotals).reduce((s, v) => s + v, 0);
  const entryCount = Object.keys(entriesMap).length;

  const handleSave = useCallback(async (data) => {
    // When saving from "all" view, use the machine's real factory
    const targetFactory = data._factory || data.factory || factory;
    const stableId = makeEntryId(targetFactory, data.machine, data.date);
    const entry = { ...data, id: stableId, factory: targetFactory };
    delete entry._factory;
    upsertEntry(entry);
    try { await savePlanningEntry(entry); }
    catch (err) { console.error('Save failed:', err); }
  }, [upsertEntry, factory]);

  const handleDelete = useCallback(async (id) => {
    deleteEntry(id);
    try { await deletePlanningEntry(id); }
    catch (err) { console.error('Delete failed:', err); }
  }, [deleteEntry]);

  const handleDragStart = useCallback((e, entry) => {
    e.dataTransfer.setData('application/json', JSON.stringify(entry));
  }, []);

  const handleDrop = useCallback(async (event, destMachine, destDate) => {
    event.preventDefault();
    const dataStr = event.dataTransfer.getData('application/json');
    if (!dataStr) return;
    try {
      const sourceEntry = JSON.parse(dataStr);
      const s = sourceEntry.date < destDate ? sourceEntry.date : destDate;
      const e = sourceEntry.date > destDate ? sourceEntry.date : destDate;
      let curr = new Date(s + 'T12:00:00Z');
      const end = new Date(e + 'T12:00:00Z');
      while (curr <= end) {
        const d = curr.toISOString().split('T')[0];
        await handleSave({ ...sourceEntry, machine: destMachine.id, machineName: destMachine.name, date: d, _factory: destMachine._factory });
        curr.setUTCDate(curr.getUTCDate() + 1);
      }
    } catch (err) { console.error('Drop error:', err); }
  }, [handleSave]);

  // For modal — pass the machine's actual factory
  const openModal = (entry, machine, date) => {
    if (isSupervisor) return;
    setModal({ entry: entry || null, machine, date, factory: machine._factory || factory });
  };

  return (
    <div className="flex flex-col bg-brand-bg" style={{ height: 'calc(100vh - 56px)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border bg-brand-surface/30 shrink-0 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2 tracking-tight">
            <CalendarDays size={20} className="text-brand-cyan" />
            Planejamento de Produção
          </h1>
          <p className="text-[10px] text-brand-muted mt-0.5 uppercase tracking-widest font-black">
            {monthLabel} · {isAllUnits ? 'Todas as Unidades' : (factory === 'matriz' ? 'Matriz' : 'Filial')}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Legend />
          <div className="flex items-center gap-1 bg-brand-card border border-brand-border rounded-xl p-1">
            <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-white/5 rounded-lg text-brand-muted hover:text-white transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-white px-3 min-w-[100px] text-center capitalize">
              {new Date(month.year, month.month).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
            </span>
            <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-white/5 rounded-lg text-brand-muted hover:text-white transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
          {!isSupervisor && (
            <button
              onClick={() => setModal({ entry: null, machine: null, date: new Date().toISOString().split('T')[0], factory: isAllUnits ? 'matriz' : factory })}
              className="flex items-center gap-2 px-4 py-2 bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/20 text-brand-cyan text-xs font-bold rounded-xl transition-all active:scale-95">
              <Plus size={14} /> Nova entrada
            </button>
          )}
        </div>
      </div>

      {/* KPI bar */}
      <div className="px-6 py-3 flex items-center gap-8 border-b border-brand-border/40 shrink-0 flex-wrap bg-brand-surface/10">
        {[
          { label: 'Total Planejado', value: grandTotal.toLocaleString('pt-BR'), unit: 'kg', icon: Package },
          { label: 'Máquinas',        value: machineList.length, icon: Cpu },
          { label: 'Dias no Mês',     value: days.length, icon: CalendarDays },
          { label: 'Entradas',        value: entryCount, icon: Activity },
        ].map((k) => (
          <div key={k.label} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-brand-border flex items-center justify-center">
              <k.icon size={14} className="text-brand-muted" />
            </div>
            <div>
              <p className="text-[9px] text-brand-muted uppercase font-bold tracking-tighter leading-none mb-1">{k.label}</p>
              <div className="flex items-baseline gap-0.5">
                <span className="text-xs font-mono font-bold text-white">{k.value}</span>
                {k.unit && <span className="text-[9px] text-brand-muted font-bold">{k.unit}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Matrix */}
      <div className="flex-1 overflow-auto w-full">
        <table className="border-collapse w-full min-w-fit">
          <thead>
            <tr className="sticky top-0 z-20 bg-brand-bg/95 backdrop-blur-sm">
              <th className="sticky left-0 z-30 bg-brand-bg border border-brand-border/40 px-2 md:px-3 lg:px-4 py-2 md:py-2.5 lg:py-3 text-left min-w-[80px] md:min-w-[100px] lg:min-w-[110px] shadow-[4px_0_12px_rgba(0,0,0,0.4)]">
                <span className="text-[8px] md:text-[9px] lg:text-[10px] font-bold text-brand-muted uppercase tracking-wider">Máquina</span>
              </th>
              {days.map((date) => {
                const today = isToday(date);
                const isSun = new Date(date + 'T12:00:00').getDay() === 0;
                return (
                  <th key={date}
                    className="border border-brand-border/40 min-w-[40px] md:min-w-[50px] w-[40px] md:w-[50px] py-1 md:py-1.5 lg:py-2 px-0.5 text-center"
                    style={today ? { background: 'rgba(34,211,238,0.06)', borderColor: 'rgba(34,211,238,0.25)' } : {}}>
                    <div className="flex flex-col items-center gap-0">
                      <span className={`text-[7px] md:text-[8px] lg:text-[9px] font-medium uppercase ${isSun ? 'text-red-400/80' : 'text-brand-muted'}`}>{getWeekday(date)}</span>
                      <span className={`text-[9px] md:text-[10px] lg:text-[11px] font-mono font-bold leading-none ${today ? 'text-brand-cyan' : isSun ? 'text-red-400/60' : 'text-brand-muted'}`}>{date.split('-')[2]}</span>
                    </div>
                  </th>
                );
              })}
              <th className="sticky right-0 z-30 bg-brand-bg border border-brand-border/40 px-1.5 md:px-2 lg:px-3 py-2 md:py-2.5 lg:py-3 min-w-[55px] md:min-w-[70px] lg:min-w-[80px] text-right shadow-[-4px_0_12px_rgba(0,0,0,0.4)]">
                <span className="text-[8px] md:text-[9px] lg:text-[10px] font-bold text-brand-muted uppercase tracking-wider">Total</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const rows = [];
              let lastFactory = null;
              machineList.forEach((machine) => {
                // Insert factory divider in "all" view
                if (isAllUnits && machine._factory !== lastFactory) {
                  lastFactory = machine._factory;
                  const fData = FACTORIES.find((f) => f.id === machine._factory);
                  rows.push(<FactoryDivider key={`div-${machine._factory}`} label={fData?.name || machine._factory} color={fData?.color || '#64748b'} />);
                }
                rows.push(
                  <tr key={`${machine._factory}-${machine.id}`} className="group hover:bg-white/[0.01]">
                    <td className="sticky left-0 z-10 bg-brand-bg group-hover:bg-brand-surface/20 border border-brand-border/40 px-2 md:px-3 lg:px-4 py-0 transition-colors shadow-[4px_0_12px_rgba(0,0,0,0.4)]">
                      <div className="py-1 md:py-1.5 lg:py-2 min-w-[70px] md:min-w-[90px] lg:min-w-[100px]">
                        <span className="text-[9px] md:text-xs lg:text-sm font-bold text-white block truncate leading-tight">{machine.id}</span>
                        <span className="text-[8px] md:text-[9px] lg:text-[10px] text-brand-muted block truncate leading-tight mt-0.5">{machine.name}</span>
                      </div>
                    </td>
                    {days.map((date) => (
                      <MatrixCell
                        key={date}
                        entry={getEntry(machine, date)}
                        date={date}
                        machine={machine}
                        isCurrentDay={isToday(date)}
                        onClick={!isSupervisor ? (e, m, d) => openModal(e, m, d) : undefined}
                        onDragStart={!isSupervisor ? handleDragStart : undefined}
                        onDrop={!isSupervisor ? handleDrop : undefined}
                      />
                    ))}
                    <td className="sticky right-0 z-10 bg-brand-bg group-hover:bg-brand-surface/20 border border-brand-border/40 px-1.5 md:px-2 lg:px-3 transition-colors text-right shadow-[-4px_0_12px_rgba(0,0,0,0.4)]">
                      <span className="text-[9px] md:text-xs lg:text-sm font-mono font-bold text-brand-cyan">{(machineTotals[machine.id] || 0).toLocaleString('pt-BR')}</span>
                      <span className="text-[7px] md:text-[8px] lg:text-[10px] text-brand-muted ml-0.5">kg</span>
                    </td>
                  </tr>
                );
              });
              return rows;
            })()}
            {/* Total row */}
            <tr className="border-t-2 border-brand-border">
              <td className="sticky left-0 z-10 bg-brand-surface border border-brand-border/40 px-2 md:px-3 lg:px-4 py-1 md:py-1.5 lg:py-2.5 shadow-[4px_0_12px_rgba(0,0,0,0.4)]">
                <span className="text-[8px] md:text-[9px] lg:text-[10px] font-bold text-brand-muted uppercase tracking-wider">Total</span>
              </td>
              {days.map((date) => {
                const dayTotal = machineList.reduce((s, m) => {
                  const e = getEntry(m, date);
                  return s + (e?.cellType === 'producao' ? (e.planned || 0) : 0);
                }, 0);
                return (
                  <td key={date} className="border border-brand-border/40 bg-brand-surface text-center"
                    style={isToday(date) ? { background: 'rgba(34,211,238,0.04)' } : {}}>
                    <span className="text-[7px] md:text-[8px] lg:text-[10px] font-mono text-brand-muted">
                      {dayTotal > 0 ? (dayTotal >= 1000 ? `${(dayTotal / 1000).toFixed(1)}k` : dayTotal) : '—'}
                    </span>
                  </td>
                );
              })}
              <td className="sticky right-0 z-10 bg-brand-surface border border-brand-border/40 px-1.5 md:px-2 lg:px-3 text-right shadow-[-4px_0_12px_rgba(0,0,0,0.4)]">
                <span className="text-[10px] md:text-[11px] lg:text-sm font-mono font-bold text-brand-cyan">{grandTotal.toLocaleString('pt-BR')}</span>
                <span className="text-[7px] md:text-[8px] lg:text-[10px] text-brand-muted ml-0.5">kg</span>
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
          factory={modal.factory}
          products={products}
          machines={
            // In "all" view, show machines from the relevant factory
            modal.factory === 'matriz' ? (adminMachines.matriz || []) :
            modal.factory === 'filial' ? (adminMachines.filial || []) :
            machineList
          }
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
