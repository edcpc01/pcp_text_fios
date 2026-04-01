import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight, X, Save, Trash2, Calendar, Package, Layers } from 'lucide-react';
import { useAppStore, usePlanningStore, MACHINES, PRODUCTS } from '../hooks/useStore';
import { subscribePlanningEntries, savePlanningEntry, deletePlanningEntry } from '../services/firebase';
import { getDaysInMonth, isSunday, getWeekday, formatDate, getMonthLabel, isToday, isPast } from '../utils/dates';
import { seedDemoData } from '../utils/seedData';

// ─── Modal de entrada ────────────────────────────────────────────────────────

function EntryModal({ entry, machine, date, factory, onSave, onDelete, onClose }) {
  const isEdit = !!entry?.id && !entry.id.startsWith('local-');
  const [form, setForm] = useState({
    machine: entry?.machine || machine?.id || '',
    machineName: entry?.machineName || machine?.name || '',
    product: entry?.product || PRODUCTS[0].id,
    productName: entry?.productName || PRODUCTS[0].name,
    date: entry?.date || date || '',
    planned: entry?.planned || (machine ? Math.round(machine.capacity * 0.8) : 400),
    quality: entry?.quality || 'A',
    side: entry?.side || 'Lado A',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedMachine = MACHINES[factory]?.find((m) => m.id === form.machine) || machine;

  const handleProductChange = (productId) => {
    const p = PRODUCTS.find((p) => p.id === productId);
    if (p) setForm((f) => ({ ...f, product: p.id, productName: p.name }));
  };

  const handleMachineChange = (machineId) => {
    const m = MACHINES[factory]?.find((m) => m.id === machineId);
    if (m) setForm((f) => ({
      ...f,
      machine: m.id,
      machineName: m.name,
      planned: Math.round(m.capacity * 0.8),
    }));
  };

  const handleSubmit = async () => {
    if (!form.machine || !form.product || !form.date || !form.planned) return;
    setSaving(true);
    try {
      await onSave({ ...entry, ...form, factory });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!entry?.id) return;
    setDeleting(true);
    try {
      await onDelete(entry.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full sm:max-w-md bg-brand-navy border border-white/[0.08] rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/60 animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              {isEdit ? 'Editar Planejamento' : 'Novo Planejamento'}
            </h3>
            {form.date && (
              <p className="text-xs text-slate-500 mt-0.5">{formatDate(form.date)} · {form.machineName}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* Máquina + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Máquina</label>
              <select
                value={form.machine}
                onChange={(e) => handleMachineChange(e.target.value)}
                className="w-full bg-brand-slate/60 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-brand-doptex/50 transition-all"
              >
                {MACHINES[factory]?.map((m) => (
                  <option key={m.id} value={m.id}>{m.id} — {m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Data</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full bg-brand-slate/60 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-brand-doptex/50 transition-all"
              />
            </div>
          </div>

          {/* Produto */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Produto</label>
            <select
              value={form.product}
              onChange={(e) => handleProductChange(e.target.value)}
              className="w-full bg-brand-slate/60 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-brand-doptex/50 transition-all"
            >
              {PRODUCTS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Produção + Lado + Qualidade */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Prod. (kg)</label>
              <input
                type="number"
                value={form.planned}
                onChange={(e) => setForm((f) => ({ ...f, planned: Number(e.target.value) }))}
                min={0}
                max={9999}
                className="w-full bg-brand-slate/60 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-brand-doptex/50 transition-all"
              />
              {selectedMachine && (
                <p className="text-[10px] text-slate-600 mt-1">Cap: {selectedMachine.capacity} kg</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Lado</label>
              <select
                value={form.side}
                onChange={(e) => setForm((f) => ({ ...f, side: e.target.value }))}
                className="w-full bg-brand-slate/60 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-brand-doptex/50 transition-all"
              >
                <option>Lado A</option>
                <option>Lado B</option>
                <option>Único</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Qual.</label>
              <select
                value={form.quality}
                onChange={(e) => setForm((f) => ({ ...f, quality: e.target.value }))}
                className="w-full bg-brand-slate/60 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-brand-doptex/50 transition-all"
              >
                <option value="A">A</option>
                <option value="B">B</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 pb-5 pt-2">
          {isEdit && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-40"
            >
              <Trash2 size={13} />
              {deleting ? 'Removendo...' : 'Remover'}
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors rounded-xl"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.machine || !form.date || !form.planned}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-doptex hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-all"
          >
            <Save size={13} />
            {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Célula da Matriz ────────────────────────────────────────────────────────

function MatrixCell({ entry, date, machine, factory, isSun, isCurrentDay, onClick }) {
  if (isSun) {
    return (
      <td className="border border-white/[0.04] bg-red-950/20 min-w-[52px] w-[52px]">
        <div className="h-12 flex items-center justify-center">
          <span className="text-[9px] text-red-900 font-medium rotate-90">DOM</span>
        </div>
      </td>
    );
  }

  const hasEntry = !!entry;
  const isPastDay = isPast(date);

  return (
    <td
      onClick={() => onClick(entry, machine, date)}
      className={`
        border border-white/[0.04] min-w-[52px] w-[52px] cursor-pointer transition-all duration-150
        ${isCurrentDay ? 'bg-brand-doptex/10 border-brand-doptex/20' : ''}
        ${hasEntry ? 'hover:bg-white/[0.05]' : 'hover:bg-white/[0.03]'}
      `}
    >
      <div className="h-12 flex flex-col items-center justify-center gap-0.5 px-1">
        {hasEntry ? (
          <>
            <span className="text-[11px] font-mono font-semibold text-slate-200 leading-none">
              {entry.planned >= 1000
                ? `${(entry.planned / 1000).toFixed(1)}k`
                : entry.planned}
            </span>
            <div className="flex items-center gap-0.5">
              <span className={`text-[9px] font-medium px-1 rounded ${entry.quality === 'A' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {entry.quality}
              </span>
            </div>
          </>
        ) : (
          <div className={`w-4 h-4 rounded-full border border-dashed flex items-center justify-center transition-opacity
            ${isPastDay ? 'border-red-800/40 opacity-40' : 'border-slate-700 opacity-30 group-hover:opacity-60'}`}>
            <Plus size={8} className="text-slate-500" />
          </div>
        )}
      </div>
    </td>
  );
}

// ─── Planning Page ────────────────────────────────────────────────────────────

export default function Planning() {
  const { factory, month, changeMonth, getYearMonth } = useAppStore();
  const { entries, setEntries, setLoading, addEntry, updateEntry, deleteEntry } = usePlanningStore();

  const [modal, setModal] = useState(null); // { entry, machine, date }
  const [showNewModal, setShowNewModal] = useState(false);

  const machines = MACHINES[factory] || [];
  const days = getDaysInMonth(month.year, month.month);
  const yearMonth = getYearMonth();
  const monthLabel = getMonthLabel(month.year, month.month);

  // Carregar entradas do Firebase com live update
  useEffect(() => {
    setLoading(true);
    const unsub = subscribePlanningEntries(factory, yearMonth, (data) => {
      // Se não há dados reais, carregar seed demo
      if (data.length === 0) {
        const { entries: demo } = seedDemoData();
        const factoryDemo = demo.filter(
          (e) => e.factory === factory && e.date.startsWith(yearMonth)
        );
        setEntries(factoryDemo);
      } else {
        setEntries(data);
      }
    });
    return () => unsub();
  }, [factory, yearMonth]);

  // Mapa rápido: machine+date → entry
  const entryMap = {};
  entries.forEach((e) => {
    const key = `${e.machine}-${e.date}`;
    if (!entryMap[key]) entryMap[key] = e;
    else {
      // Se há múltiplos (Lado A + B), somar planejado
      entryMap[key] = { ...entryMap[key], planned: (entryMap[key].planned || 0) + (e.planned || 0) };
    }
  });

  // Total por máquina
  const machineTotals = {};
  machines.forEach((m) => {
    machineTotals[m.id] = entries
      .filter((e) => e.machine === m.id)
      .reduce((sum, e) => sum + (e.planned || 0), 0);
  });

  // Total geral
  const grandTotal = Object.values(machineTotals).reduce((s, v) => s + v, 0);

  const handleCellClick = (entry, machine, date) => {
    setModal({ entry: entry || null, machine, date });
  };

  const handleSave = useCallback(async (data) => {
    const saved = { ...data };
    try {
      const id = await savePlanningEntry(saved);
      if (saved.id) {
        updateEntry(saved.id, { ...saved, id });
      } else {
        addEntry({ ...saved, id });
      }
    } catch (err) {
      console.error('Erro ao salvar:', err);
      // Otimistic update mesmo com erro (offline mode)
      if (!saved.id) addEntry({ ...saved, id: `local-${Date.now()}` });
    }
  }, [addEntry, updateEntry]);

  const handleDelete = useCallback(async (id) => {
    try {
      await deletePlanningEntry(id);
    } catch (err) {
      console.error('Erro ao deletar:', err);
    }
    deleteEntry(id);
  }, [deleteEntry]);

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Planejamento</h1>
          <p className="text-xs text-slate-500 mt-0.5 capitalize">{monthLabel}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Navegação de mês */}
          <div className="flex items-center gap-1 bg-brand-slate/50 rounded-xl p-1 border border-white/[0.06]">
            <button
              onClick={() => changeMonth(-1)}
              className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors text-slate-400 hover:text-slate-200"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-medium text-slate-300 px-2 capitalize min-w-[80px] text-center">
              {new Date(month.year, month.month).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
            </span>
            <button
              onClick={() => changeMonth(1)}
              className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors text-slate-400 hover:text-slate-200"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-doptex hover:bg-sky-400 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-sky-500/20"
          >
            <Plus size={13} />
            Nova entrada
          </button>
        </div>
      </div>

      {/* ─── KPI rápido ──────────────────────────────────────────────────── */}
      <div className="px-6 py-3 flex items-center gap-6 border-b border-white/[0.04] shrink-0">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total planejado</p>
          <p className="text-base font-mono font-bold text-slate-100">
            {grandTotal.toLocaleString('pt-BR')} <span className="text-xs font-normal text-slate-500">kg</span>
          </p>
        </div>
        <div className="w-px h-6 bg-white/[0.06]" />
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Máquinas</p>
          <p className="text-base font-mono font-bold text-slate-100">{machines.length}</p>
        </div>
        <div className="w-px h-6 bg-white/[0.06]" />
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Dias úteis</p>
          <p className="text-base font-mono font-bold text-slate-100">
            {days.filter((d) => !isSunday(d)).length}
          </p>
        </div>
        <div className="w-px h-6 bg-white/[0.06]" />
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Entradas</p>
          <p className="text-base font-mono font-bold text-slate-100">{entries.length}</p>
        </div>
      </div>

      {/* ─── Matriz ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse w-max min-w-full">
          <thead>
            <tr className="sticky top-0 z-10 bg-brand-dark/95 backdrop-blur-sm">
              {/* Coluna máquina */}
              <th className="sticky left-0 z-20 bg-brand-dark/95 backdrop-blur-sm border border-white/[0.04] px-4 py-3 text-left min-w-[130px]">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Máquina</span>
              </th>

              {/* Colunas de dias */}
              {days.map((date) => {
                const sun = isSunday(date);
                const today = isToday(date);
                const dayNum = date.split('-')[2];
                const weekday = getWeekday(date);
                return (
                  <th
                    key={date}
                    className={`border border-white/[0.04] min-w-[52px] w-[52px] py-2 px-1 text-center
                      ${sun ? 'bg-red-950/30' : ''}
                      ${today ? 'bg-brand-doptex/10' : ''}
                    `}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={`text-[9px] font-medium uppercase ${sun ? 'text-red-800' : 'text-slate-600'}`}>
                        {weekday}
                      </span>
                      <span className={`text-[11px] font-mono font-bold ${today ? 'text-brand-doptex' : sun ? 'text-red-800' : 'text-slate-400'}`}>
                        {dayNum}
                      </span>
                    </div>
                  </th>
                );
              })}

              {/* Coluna total */}
              <th className="sticky right-0 z-20 bg-brand-dark/95 backdrop-blur-sm border border-white/[0.04] px-3 py-3 min-w-[80px] text-right">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {machines.map((machine) => (
              <tr key={machine.id} className="group hover:bg-white/[0.01] transition-colors">
                {/* Nome da máquina */}
                <td className="sticky left-0 z-10 bg-brand-dark group-hover:bg-[#0d1424] border border-white/[0.04] px-4 py-0 transition-colors">
                  <div className="flex flex-col py-1">
                    <span className="text-xs font-semibold text-slate-200">{machine.id}</span>
                    <span className="text-[10px] text-slate-500">{machine.name}</span>
                  </div>
                </td>

                {/* Células de dias */}
                {days.map((date) => {
                  const key = `${machine.id}-${date}`;
                  const entry = entryMap[key];
                  return (
                    <MatrixCell
                      key={date}
                      entry={entry}
                      date={date}
                      machine={machine}
                      factory={factory}
                      isSun={isSunday(date)}
                      isCurrentDay={isToday(date)}
                      onClick={handleCellClick}
                    />
                  );
                })}

                {/* Total da máquina */}
                <td className="sticky right-0 z-10 bg-brand-dark group-hover:bg-[#0d1424] border border-white/[0.04] px-3 transition-colors">
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-slate-200">
                      {(machineTotals[machine.id] || 0).toLocaleString('pt-BR')}
                    </span>
                    <span className="text-[10px] text-slate-600 ml-0.5">kg</span>
                  </div>
                </td>
              </tr>
            ))}

            {/* Linha de totais */}
            <tr className="border-t-2 border-white/[0.08]">
              <td className="sticky left-0 z-10 bg-brand-navy border border-white/[0.04] px-4 py-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
              </td>
              {days.map((date) => {
                if (isSunday(date)) return (
                  <td key={date} className="border border-white/[0.04] bg-red-950/20 min-w-[52px]" />
                );
                const dayTotal = machines.reduce((sum, m) => {
                  const e = entryMap[`${m.id}-${date}`];
                  return sum + (e?.planned || 0);
                }, 0);
                return (
                  <td key={date} className={`border border-white/[0.04] bg-brand-navy text-center ${isToday(date) ? 'bg-brand-doptex/10' : ''}`}>
                    <span className="text-[10px] font-mono font-semibold text-slate-400">
                      {dayTotal > 0 ? (dayTotal >= 1000 ? `${(dayTotal / 1000).toFixed(1)}k` : dayTotal) : '—'}
                    </span>
                  </td>
                );
              })}
              <td className="sticky right-0 z-10 bg-brand-navy border border-white/[0.04] px-3 text-right">
                <span className="text-sm font-mono font-bold text-brand-doptex">
                  {grandTotal.toLocaleString('pt-BR')}
                </span>
                <span className="text-[10px] text-slate-500 ml-0.5">kg</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ─── Modais ──────────────────────────────────────────────────────── */}
      {modal && (
        <EntryModal
          entry={modal.entry}
          machine={modal.machine}
          date={modal.date}
          factory={factory}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}

      {showNewModal && (
        <EntryModal
          entry={null}
          machine={null}
          date={new Date().toISOString().split('T')[0]}
          factory={factory}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setShowNewModal(false)}
        />
      )}
    </div>
  );
}
