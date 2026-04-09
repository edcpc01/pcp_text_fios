import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Save, Package, Cpu, ChevronDown } from 'lucide-react';
import { useAdminStore, FACTORIES } from '../hooks/useStore';
import { saveProduct, saveMachineConfig } from '../services/firebase';

// ─── Modal genérico ───────────────────────────────────────────────────────────

function Modal({ title, onClose, children, onSave, saving }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#0f172a] border border-white/[0.08] rounded-2xl shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">{children}</div>
        <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-2">
          <button onClick={onClose} className="px-4 py-2.5 text-xs text-slate-400 hover:text-slate-200 rounded-xl">Cancelar</button>
          <button onClick={onSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-all">
            <Save size={13} />{saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full bg-brand-slate/60 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/40 transition-all';

// ─── Machines section ─────────────────────────────────────────────────────────

function MachinesSection() {
  const { machines, addMachine, updateMachine, deleteMachine } = useAdminStore();
  const [factory, setFactory] = useState('matriz');
  const [modal, setModal] = useState(null); // null | { mode: 'add'|'edit', data }
  const [form, setForm] = useState({ id: '', name: '', sides: 2, capacity: 420 });
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setForm({ id: '', name: '', sides: 2, capacity: 420 });
    setModal({ mode: 'add' });
  };

  const openEdit = (m) => {
    setForm({ ...m });
    setModal({ mode: 'edit', original: m });
  };

  const handleSave = async () => {
    if (!form.id || !form.name) return;
    setSaving(true);
    try {
      const data = { ...form, capacity: Number(form.capacity), sides: Number(form.sides) };
      if (modal.mode === 'add') {
        addMachine(factory, data);
      } else {
        updateMachine(factory, modal.original.id, data);
      }
      await saveMachineConfig(factory, data.id, data);
    } finally {
      setSaving(false);
      setModal(null);
    }
  };

  const handleRemove = (id) => {
    if (window.confirm('Remover esta máquina?')) deleteMachine(factory, id);
  };

  return (
    <div className="bg-brand-navy border border-white/[0.06] rounded-2xl">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Cpu size={16} className="text-emerald-400" />
          <h2 className="text-sm font-semibold text-slate-200">Máquinas</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Factory selector */}
          <div className="relative">
            <select value={factory} onChange={(e) => setFactory(e.target.value)}
              className="appearance-none bg-brand-slate/60 border border-white/[0.08] rounded-xl pl-3 pr-8 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/40 cursor-pointer">
              {FACTORIES.filter((f) => f.id !== 'all').map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all">
            <Plus size={12} />Nova
          </button>
        </div>
      </div>

      <div className="p-4">
        {(machines[factory] || []).length === 0 ? (
          <p className="text-center text-slate-600 text-sm py-8">Nenhuma máquina cadastrada</p>
        ) : (
          <div className="space-y-2">
            {(machines[factory] || []).map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 bg-brand-slate/30 rounded-xl border border-white/[0.04] group hover:border-white/[0.08] transition-all">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-emerald-400">{m.id}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{m.name}</p>
                  <p className="text-[11px] text-slate-500">{m.sides} {m.sides === 1 ? 'lado' : 'lados'} · {m.capacity} kg/dia</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(m)} className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] rounded-lg transition-all"><Pencil size={13} /></button>
                  <button onClick={() => handleRemove(m.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <Modal title={modal.mode === 'add' ? 'Nova Máquina' : 'Editar Máquina'} onClose={() => setModal(null)} onSave={handleSave} saving={saving}>
          <Field label="ID (ex: M12, F09)">
            <input value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value.toUpperCase() }))}
              placeholder="M12" disabled={modal.mode === 'edit'} className={inputCls} />
          </Field>
          <Field label="Nome">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Máquina 12" className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lados">
              <select value={form.sides} onChange={(e) => setForm((f) => ({ ...f, sides: Number(e.target.value) }))} className={inputCls}>
                <option value={1}>1 lado</option>
                <option value={2}>2 lados</option>
              </select>
            </Field>
            <Field label="Capacidade (kg/dia)">
              <input type="number" value={form.capacity} min={100} max={2000}
                onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} className={inputCls} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Products section ─────────────────────────────────────────────────────────

const PRODUCT_TYPES = ['DTY', 'ATY', 'FDY', 'POY', 'Outro'];

function ProductsSection() {
  const { products, addProduct, updateProduct, deleteProduct } = useAdminStore();
  const [modal, setModal] = useState(null);
  const EMPTY_FORM = { id: '', nome: '', cliente: '', type: 'DTY', dtex: 150, filaments: 48, prodDiaPosicao: 0 };
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    const nextId = `P${String(products.length + 1).padStart(3, '0')}`;
    setForm({ ...EMPTY_FORM, id: nextId });
    setModal({ mode: 'add' });
  };

  const openEdit = (p) => {
    setForm({
      id:             p.id || '',
      nome:           p.nome || p.name || '',
      cliente:        p.cliente || '',
      type:           p.type || 'DTY',
      dtex:           p.dtex || 150,
      filaments:      p.filaments || 48,
      prodDiaPosicao: p.prodDiaPosicao || 0,
    });
    setModal({ mode: 'edit', original: p });
  };

  const handleSave = async () => {
    if (!form.nome) return;
    setSaving(true);
    try {
      const data = {
        ...form,
        name:           form.nome,    // backward compat
        dtex:           Number(form.dtex),
        filaments:      Number(form.filaments),
        prodDiaPosicao: Number(form.prodDiaPosicao),
      };
      if (modal.mode === 'add') {
        addProduct(data);
        await saveProduct(data);
      } else {
        updateProduct(modal.original.id, data);
        await saveProduct({ ...modal.original, ...data });
      }
    } finally {
      setSaving(false);
      setModal(null);
    }
  };

  const handleRemove = (id) => {
    if (window.confirm('Remover este produto?')) deleteProduct(id);
  };

  const TYPE_COLORS = {
    DTY: 'text-sky-400 bg-sky-500/10',
    ATY: 'text-violet-400 bg-violet-500/10',
    FDY: 'text-amber-400 bg-amber-500/10',
    POY: 'text-rose-400 bg-rose-500/10',
    Outro: 'text-slate-400 bg-slate-500/10',
  };

  // Group products by cliente for display
  const byCliente = {};
  products.forEach((p) => {
    const c = p.cliente || 'Sem Cliente';
    if (!byCliente[c]) byCliente[c] = [];
    byCliente[c].push(p);
  });
  const clienteList = Object.keys(byCliente).sort();

  return (
    <div className="bg-brand-navy border border-white/[0.06] rounded-2xl">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Package size={16} className="text-indigo-400" />
          <h2 className="text-sm font-semibold text-slate-200">Produtos</h2>
          <span className="text-[10px] font-bold text-slate-500 bg-brand-slate/40 px-1.5 py-0.5 rounded-full">{products.length}</span>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all">
          <Plus size={12} />Novo
        </button>
      </div>

      <div className="p-4">
        {products.length === 0 ? (
          <p className="text-center text-slate-600 text-sm py-8">Nenhum produto cadastrado</p>
        ) : (
          <div className="space-y-4">
            {clienteList.map((cliente) => (
              <div key={cliente}>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">{cliente}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {byCliente[cliente].map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3 bg-brand-slate/30 rounded-xl border border-white/[0.04] group hover:border-white/[0.08] transition-all">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg shrink-0 ${TYPE_COLORS[p.type] || TYPE_COLORS.Outro}`}>{p.type}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{p.nome || p.name}</p>
                        <p className="text-[11px] text-slate-500">{p.dtex} dtex · {p.filaments} fil.</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(p)} className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] rounded-lg transition-all"><Pencil size={13} /></button>
                        <button onClick={() => handleRemove(p.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <Modal title={modal.mode === 'add' ? 'Novo Produto' : 'Editar Produto'} onClose={() => setModal(null)} onSave={handleSave} saving={saving}>
          <Field label="Nome">
            <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="FIO PES REVESO 1X100/96+40 CRU" className={inputCls} />
          </Field>
          <Field label="Cliente">
            <input value={form.cliente} onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))}
              placeholder="Ex: Corradi, Doptex..." className={inputCls} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Tipo">
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={inputCls}>
                {PRODUCT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Dtex">
              <input type="number" value={form.dtex} min={10} max={1000}
                onChange={(e) => setForm((f) => ({ ...f, dtex: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Filamentos">
              <input type="number" value={form.filaments} min={1} max={500}
                onChange={(e) => setForm((f) => ({ ...f, filaments: e.target.value }))} className={inputCls} />
            </Field>
          </div>
          <Field label="Prod. kg/dia/posição">
            <input type="number" value={form.prodDiaPosicao} min={0} step={0.01}
              onChange={(e) => setForm((f) => ({ ...f, prodDiaPosicao: e.target.value }))} className={inputCls} />
          </Field>
        </Modal>
      )}
    </div>
  );
}

// ─── Cadastro Page ─────────────────────────────────────────────────────────────

export default function Cadastro() {
  return (
    <div className="h-full overflow-auto p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold text-slate-100">Cadastros</h1>
        <p className="text-xs text-slate-500 mt-0.5">Gerenciamento de máquinas e produtos · Acesso Administrador</p>
      </div>
      <MachinesSection />
      <ProductsSection />
    </div>
  );
}
