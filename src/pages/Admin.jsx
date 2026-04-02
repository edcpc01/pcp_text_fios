import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Save, Package, Cpu } from 'lucide-react';
import { useAdminStore, FACTORIES, CELL_TYPES } from '../hooks/useStore';

const TABS = [
  { id: 'products', label: 'Produtos', icon: Package },
  { id: 'machines', label: 'Máquinas', icon: Cpu },
];

// ─── Product Modal ────────────────────────────────────────────────────────────
function ProductModal({ product, onSave, onClose }) {
  const [form, setForm] = useState({
    id:        product?.id        || `P${String(Date.now()).slice(-3)}`,
    name:      product?.name      || '',
    type:      product?.type      || 'DTY',
    dtex:      product?.dtex      || 150,
    filaments: product?.filaments || 48,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-brand-card border border-brand-border rounded-2xl shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-brand-border">
          <h3 className="text-sm font-semibold text-white">{product ? 'Editar Produto' : 'Novo Produto'}</h3>
          <button onClick={onClose} className="text-brand-muted hover:text-white p-1 rounded-lg"><X size={14} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">ID</label>
              <input value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-cyan/50 transition-all font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">Tipo</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-cyan/50 transition-all">
                <option>DTY</option><option>ATY</option><option>FDY</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">Nome</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="ex: DTY 150/48"
              className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-cyan/50 transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">Dtex</label>
              <input type="number" value={form.dtex} onChange={(e) => setForm((f) => ({ ...f, dtex: Number(e.target.value) }))}
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-brand-cyan/50 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">Filamentos</label>
              <input type="number" value={form.filaments} onChange={(e) => setForm((f) => ({ ...f, filaments: Number(e.target.value) }))}
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-brand-cyan/50 transition-all" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-xs text-brand-muted hover:text-white rounded-xl transition-colors">Cancelar</button>
          <button onClick={() => { onSave(form); onClose(); }} disabled={!form.name}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-semibold rounded-xl transition-all disabled:opacity-40 hover:bg-brand-cyan/20">
            <Save size={12} /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Machine Modal ────────────────────────────────────────────────────────────
function MachineModal({ machine, factory, onSave, onClose }) {
  const [form, setForm] = useState({
    id:       machine?.id       || '',
    name:     machine?.name     || '',
    sides:    machine?.sides    || 2,
    capacity: machine?.capacity || 400,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-brand-card border border-brand-border rounded-2xl shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-brand-border">
          <h3 className="text-sm font-semibold text-white">{machine ? 'Editar Máquina' : 'Nova Máquina'}</h3>
          <button onClick={onClose} className="text-brand-muted hover:text-white p-1 rounded-lg"><X size={14} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">ID</label>
              <input value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} placeholder="ex: M12"
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-brand-cyan/50 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">Lados</label>
              <select value={form.sides} onChange={(e) => setForm((f) => ({ ...f, sides: Number(e.target.value) }))}
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-cyan/50 transition-all">
                <option value={1}>1 lado</option><option value={2}>2 lados</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">Nome</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="ex: Máquina 12"
              className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-cyan/50 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-brand-muted mb-1.5 uppercase tracking-wider">Capacidade (kg/dia)</label>
            <input type="number" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
              className="w-full bg-brand-surface border border-brand-border rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-brand-cyan/50 transition-all" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-xs text-brand-muted hover:text-white rounded-xl transition-colors">Cancelar</button>
          <button onClick={() => { onSave(factory, form); onClose(); }} disabled={!form.id || !form.name}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-semibold rounded-xl transition-all disabled:opacity-40 hover:bg-brand-cyan/20">
            <Save size={12} /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Page ───────────────────────────────────────────────────────────────
export default function Admin() {
  const [tab, setTab] = useState('products');
  const [selectedFactory, setSelectedFactory] = useState('matriz');
  const [modal, setModal] = useState(null);
  const { products, machines, addProduct, updateProduct, deleteProduct, addMachine, updateMachine, deleteMachine } = useAdminStore();

  const handleSaveProduct = (form) => {
    if (products.find((p) => p.id === form.id)) updateProduct(form.id, form);
    else addProduct(form);
  };

  const handleSaveMachine = (factory, form) => {
    const existing = machines[factory]?.find((m) => m.id === form.id);
    if (existing) updateMachine(factory, form.id, form);
    else addMachine(factory, form);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Cadastros</h1>
        <p className="text-sm text-brand-muted mt-0.5">Gerenciamento de produtos e máquinas — acesso restrito a administradores</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-brand-card border border-brand-border rounded-xl p-1 w-fit mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === id ? 'bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20' : 'text-brand-muted hover:text-white'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Products tab */}
      {tab === 'products' && (
        <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
            <h2 className="text-sm font-semibold text-white">Produtos Cadastrados <span className="text-brand-muted font-normal">({products.length})</span></h2>
            <button onClick={() => setModal({ type: 'product', data: null })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-semibold rounded-xl hover:bg-brand-cyan/20 transition-all">
              <Plus size={12} /> Novo produto
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-border bg-brand-surface/50">
                {['ID', 'Nome', 'Tipo', 'Dtex', 'Filamentos', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-brand-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-brand-border/50 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-brand-cyan">{p.id}</td>
                  <td className="px-4 py-3 text-sm font-medium text-white">{p.name}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-brand-surface border border-brand-border text-brand-muted">{p.type}</span></td>
                  <td className="px-4 py-3 text-sm font-mono text-brand-muted">{p.dtex}</td>
                  <td className="px-4 py-3 text-sm font-mono text-brand-muted">{p.filaments}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setModal({ type: 'product', data: p })} className="p-1.5 text-brand-muted hover:text-brand-cyan hover:bg-brand-cyan/10 rounded-lg transition-all"><Pencil size={13} /></button>
                      <button onClick={() => deleteProduct(p.id)} className="p-1.5 text-brand-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Machines tab */}
      {tab === 'machines' && (
        <div className="space-y-4">
          {/* Factory selector */}
          <div className="flex gap-2">
            {FACTORIES.map((f) => (
              <button key={f.id} onClick={() => setSelectedFactory(f.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all
                  ${selectedFactory === f.id ? 'border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan' : 'border-brand-border text-brand-muted hover:text-white bg-brand-card'}`}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
                {f.name}
              </button>
            ))}
          </div>

          <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
              <h2 className="text-sm font-semibold text-white">
                Máquinas — {FACTORIES.find((f) => f.id === selectedFactory)?.name}
                <span className="text-brand-muted font-normal"> ({machines[selectedFactory]?.length || 0})</span>
              </h2>
              <button onClick={() => setModal({ type: 'machine', data: null, factory: selectedFactory })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-semibold rounded-xl hover:bg-brand-cyan/20 transition-all">
                <Plus size={12} /> Nova máquina
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-border bg-brand-surface/50">
                  {['ID', 'Nome', 'Lados', 'Capacidade (kg/dia)', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-brand-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(machines[selectedFactory] || []).map((m) => (
                  <tr key={m.id} className="border-b border-brand-border/50 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-brand-cyan">{m.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-white">{m.name}</td>
                    <td className="px-4 py-3 text-sm text-brand-muted">{m.sides}</td>
                    <td className="px-4 py-3 text-sm font-mono text-brand-muted">{m.capacity}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setModal({ type: 'machine', data: m, factory: selectedFactory })} className="p-1.5 text-brand-muted hover:text-brand-cyan hover:bg-brand-cyan/10 rounded-lg transition-all"><Pencil size={13} /></button>
                        <button onClick={() => deleteMachine(selectedFactory, m.id)} className="p-1.5 text-brand-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'product' && (
        <ProductModal product={modal.data} onSave={handleSaveProduct} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'machine' && (
        <MachineModal machine={modal.data} factory={modal.factory} onSave={handleSaveMachine} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
