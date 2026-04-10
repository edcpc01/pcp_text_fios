import { useEffect, useState } from 'react';
import { Trash2, Save, Search } from 'lucide-react';
import { useAdminStore } from '../hooks/useStore';
import {
  subscribeForecast,
  saveForecastEntry,
  deleteForecastEntry,
} from '../services/firebase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNextMonths(n = 4) {
  const result = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      .replace('.', '').replace(' ', '/');
    result.push({ ym, label });
  }
  return result;
}

function fmtKg(v) {
  if (!v) return '—';
  return v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${Math.round(v)} kg`;
}

const MONTHS = getNextMonths(4);

// ─── Component ────────────────────────────────────────────────────────────────

export default function Forecast() {
  const { products } = useAdminStore();
  const [forecastList, setForecast] = useState([]);

  // ── Add row state ──
  const [inputCode, setInputCode]     = useState('');
  const [found, setFound]             = useState(null);   // { code, descricao }
  const [notFound, setNotFound]       = useState(false);
  const [inputMonths, setInputMonths] = useState({});     // { ym: kg }
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    const u = subscribeForecast(setForecast);
    return () => u();
  }, []);

  // ── Lookup by code (produto acabado cadastrado no Admin) ──
  function handleLookup() {
    const code = inputCode.trim();
    if (!code) return;

    // Busca pelo codigoMicrodata do produto (campo B2)
    const product = products.find(
      (p) => String(p.codigoMicrodata || '').trim() === code,
    );

    if (product) {
      setFound({ code, descricao: product.descricao || product.nome || code });
      setNotFound(false);
    } else {
      setFound(null);
      setNotFound(true);
    }
    setInputMonths({});
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleLookup();
  }

  function handleMonthChange(ym, value) {
    const n = parseFloat(value.replace(',', '.')) || 0;
    setInputMonths((prev) => ({ ...prev, [ym]: n }));
  }

  async function handleAdd() {
    if (!found) return;
    setSaving(true);
    try {
      // Merge com meses já existentes no forecast
      const existing = forecastList.find(
        (f) => String(f.code).trim() === found.code,
      );
      const prevMonths = existing?.months || {};
      const mergedMonths = { ...prevMonths };
      MONTHS.forEach(({ ym }) => {
        const v = inputMonths[ym];
        if (v !== undefined) mergedMonths[ym] = v;
      });
      await saveForecastEntry(found.code, {
        code: found.code,
        descricao: found.descricao,
        months: mergedMonths,
      });
      // Reset
      setInputCode('');
      setFound(null);
      setInputMonths({});
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Remover este item do forecast?')) return;
    await deleteForecastEntry(id);
  }

  async function handleCellEdit(item, ym, value) {
    const kg = parseFloat(String(value).replace(',', '.')) || 0;
    const months = { ...(item.months || {}), [ym]: kg };
    await saveForecastEntry(item.code, { code: item.code, descricao: item.descricao, months });
  }

  const totalByMonth = MONTHS.map(({ ym }) => ({
    ym,
    total: forecastList.reduce((s, f) => s + (f.months?.[ym] || 0), 0),
  }));

  return (
    <div className="p-6 space-y-6 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Forecast de Matéria-Prima</h1>
        <p className="text-sm text-brand-muted mt-0.5">Necessidade dos próximos 4 meses por fio</p>
      </div>

      {/* ── Adicionar item ── */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-5 space-y-4"
        style={{ borderTop: '2px solid #06b6d4' }}>
        <p className="text-xs font-bold text-brand-muted uppercase tracking-widest">Adicionar / Atualizar</p>

        {/* Busca por código */}
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-brand-muted uppercase font-bold tracking-widest">
              Cód. Microdata
            </label>
            <div className="flex gap-1">
              <input
                className="bg-brand-surface text-white text-sm rounded-lg border border-brand-border px-3 py-2
                  focus:outline-none focus:border-brand-cyan w-40 font-mono"
                placeholder="Ex: 181714"
                value={inputCode}
                onChange={(e) => { setInputCode(e.target.value); setFound(null); setNotFound(false); }}
                onKeyDown={handleKeyDown}
              />
              <button
                onClick={handleLookup}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-cyan/10 text-brand-cyan
                  border border-brand-cyan/20 hover:bg-brand-cyan/20 transition-colors text-sm font-bold"
              >
                <Search size={14} />
                Buscar
              </button>
            </div>
          </div>

          {found && (
            <div className="bg-brand-surface border border-brand-border rounded-lg px-3 py-2 text-sm text-white flex-1 min-w-0 truncate">
              <span className="text-brand-muted text-xs font-mono mr-2">{found.code}</span>
              {found.descricao}
            </div>
          )}
          {notFound && (
            <p className="text-xs text-red-400">Código não encontrado no estoque sincronizado.</p>
          )}
        </div>

        {/* Inputs de volume por mês */}
        {found && (
          <div className="flex flex-wrap gap-3 items-end">
            {MONTHS.map(({ ym, label }) => (
              <div key={ym} className="flex flex-col gap-1">
                <label className="text-[10px] text-brand-muted uppercase font-bold tracking-widest capitalize">
                  {label}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="kg"
                  className="bg-brand-surface text-white text-sm rounded-lg border border-brand-border px-3 py-2
                    focus:outline-none focus:border-brand-cyan w-28 font-mono"
                  value={inputMonths[ym] ?? ''}
                  onChange={(e) => handleMonthChange(ym, e.target.value)}
                />
              </div>
            ))}

            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-cyan text-brand-bg
                font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 self-end"
            >
              <Save size={14} />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        )}
      </div>

      {/* ── Tabela de forecast ── */}
      <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden"
        style={{ borderTop: '2px solid #8b5cf6' }}>
        <div className="p-5 pb-0">
          <p className="text-xs font-bold text-brand-muted uppercase tracking-widest mb-4">
            Forecast — próximos 4 meses
          </p>
        </div>

        {forecastList.length === 0 ? (
          <p className="text-brand-muted text-sm text-center py-10">
            Nenhum forecast cadastrado. Adicione um item acima.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border">
                  <th className="text-left px-5 py-3 text-[10px] font-bold text-brand-muted uppercase tracking-widest">
                    Cód.
                  </th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold text-brand-muted uppercase tracking-widest">
                    Descrição
                  </th>
                  {MONTHS.map(({ ym, label }) => (
                    <th key={ym} className="text-center px-4 py-3 text-[10px] font-bold text-brand-muted uppercase tracking-widest capitalize whitespace-nowrap">
                      {label}
                    </th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {forecastList.map((item) => (
                  <tr key={item.id} className="border-b border-brand-border/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 font-mono text-[11px] text-brand-muted whitespace-nowrap">
                      {item.code}
                    </td>
                    <td className="px-4 py-3 text-white font-medium max-w-[220px] truncate" title={item.descricao}>
                      {item.descricao}
                    </td>
                    {MONTHS.map(({ ym }) => (
                      <td key={ym} className="px-4 py-3 text-center">
                        <EditableCell
                          value={item.months?.[ym] || 0}
                          onSave={(v) => handleCellEdit(item, ym, v)}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-brand-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Remover"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totais */}
              <tfoot>
                <tr className="border-t border-brand-border bg-brand-surface">
                  <td colSpan={2} className="px-5 py-3 text-[10px] font-bold text-brand-muted uppercase tracking-widest">
                    Total
                  </td>
                  {totalByMonth.map(({ ym, total }) => (
                    <td key={ym} className="px-4 py-3 text-center font-mono font-bold text-brand-cyan text-sm">
                      {fmtKg(total)}
                    </td>
                  ))}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Célula editável inline ───────────────────────────────────────────────────
function EditableCell({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState('');

  function start() {
    setDraft(value ? String(value) : '');
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const n = parseFloat(String(draft).replace(',', '.')) || 0;
    if (n !== value) onSave(n);
  }

  function handleKey(e) {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min="0"
        step="0.1"
        className="bg-brand-surface text-white text-sm rounded border border-brand-cyan px-2 py-1 w-24 font-mono text-center focus:outline-none"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
      />
    );
  }

  return (
    <button
      onClick={start}
      className="font-mono text-sm text-white hover:text-brand-cyan transition-colors px-2 py-1 rounded hover:bg-white/5 min-w-[4rem]"
      title="Clique para editar"
    >
      {value ? fmtKg(value) : <span className="text-brand-muted/40">—</span>}
    </button>
  );
}
