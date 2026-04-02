import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Save, Package, Cpu, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useAdminStore, FACTORIES } from '../hooks/useStore';
// Importamos as funções de persistência
import { saveProduct, subscribeProducts, saveMachineConfig } from '../services/firebase';
import { db } from '../services/firebase';
import { doc, deleteDoc } from 'firebase/firestore';

const TABS = [
  { id: 'products', label: 'Produtos', icon: Package },
  { id: 'machines', label: 'Máquinas', icon: Cpu },
];

const EMPTY_MP = { descricao: '', codigoMicrodata: '', tituloDtex: 0, nFilamentos: 0, composicaoPct: 0 };

const EMPTY_PRODUCT = {
  id: '', cliente: '', nome: '', prodDiaPosicao: 0,
  mp1: { ...EMPTY_MP },
  mp2: { ...EMPTY_MP },
  mp3: { ...EMPTY_MP },
  descricao: '', codigoMicrodata: '', tituloComercial: '', tituloDtex: 0, composicao: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Label({ children }) {
  return <label className="block text-[10px] font-bold text-brand-muted mb-1.5 uppercase tracking-wider">{children}</label>;
}

function TextInput({ value, onChange, placeholder = '', mono = false }) {
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-brand-bg border border-brand-border rounded-xl px-3 py-2 text-sm text-white placeholder:text-brand-muted/40 focus:outline-none focus:border-brand-cyan/50 transition-all ${mono ? 'font-mono' : ''}`}
    />
  );
}

function NumberInput({ value, onChange }) {
  return (
    <input
      type="number"
      value={value ?? 0}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full bg-brand-bg border border-brand-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-brand-cyan/50 transition-all"
    />
  );
}

function SectionTitle({ label, color }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 opacity-30" style={{ background: color }} />
      <span className="text-[11px] font-bold uppercase tracking-widest px-1" style={{ color }}>{label}</span>
      <div className="h-px flex-1 opacity-30" style={{ background: color }} />
    </div>
  );
}

// ─── Materia Prima Row ────────────────────────────────────────────────────────
function MPRow({ label, data, onChange, accent }) {
  return (
    <div className="bg-brand-bg/50 border border-brand-border rounded-xl p-4">
      <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: accent }}>{label}</p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <Label>A1 — Descrição</Label>
          <TextInput value={data.descricao} onChange={(v) => onChange('descricao', v)} placeholder="ex: PES POY 1x150/48" />
        </div>
        <div>
          <Label>A2 — Código Microdata</Label>
          <TextInput value={data.codigoMicrodata} onChange={(v) => onChange('codigoMicrodata', v)} placeholder="ex: 100045" mono />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>A3 — Título Dtex</Label>
          <NumberInput value={data.tituloDtex} onChange={(v) => onChange('tituloDtex', v)} />
        </div>
        <div>
          <Label>A4 — Nº Filamentos</Label>
          <NumberInput value={data.nFilamentos} onChange={(v) => onChange('nFilamentos', v)} />
        </div>
        <div>
          <Label>A5 — Composição (%)</Label>
          <NumberInput value={data.composicaoPct} onChange={(v) => onChange('composicaoPct', v)} />
        </div>
      </div>
    </div>
  );
}

// ─── Product Modal ────────────────────────────────────────────────────────────
function ProductModal({ product, onSave, onClose }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(
    product
      ? { ...EMPTY_PRODUCT, ...product, mp1: { ...EMPTY_MP, ...product.mp1 }, mp2: { ...EMPTY_MP, ...product.mp2 }, mp3: { ...EMPTY_MP, ...product.mp3 } }
      : { ...EMPTY_PRODUCT, id: `P${String(Date.now()).slice(-3)}` }
  );

  const setMP = (key, field, val) => setForm((f) => ({ ...f, [key]: { ...f[key], [field]: val } }));
  const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const MP_ACCENTS = ['#22d3ee', '#f97316', '#a78bfa'];
  const MP_LABELS = ['Matéria Prima 1', 'Matéria Prima 2', 'Matéria Prima 3'];

  const handleSubmit = async () => {
    if (form.nome && form.id) {
      setLoading(true);
      try {
        await onSave(form);
        onClose();
      } catch (error) {
        alert("Erro ao salvar produto no banco de dados.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-brand-card border border-brand-border rounded-2xl shadow-2xl animate-fade-in my-4">

        <div className="px-6 pt-5 pb-4 border-b border-brand-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white">{product ? 'Editar Produto' : 'Novo Produto'}</h3>
            <button onClick={onClose} className="text-brand-muted hover:text-white p-1 rounded-lg"><X size={15} /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Cliente</Label>
              <TextInput value={form.cliente} onChange={(v) => set('cliente', v)} placeholder="ex: Tecelagem" />
            </div>
            <div>
              <Label>Produto / Referência</Label>
              <TextInput value={form.nome} onChange={(v) => set('nome', v)} placeholder="ex: DTY 150/48" />
            </div>
            <div>
              <Label>Prod./dia/posição (kg)</Label>
              <NumberInput value={form.prodDiaPosicao} onChange={(v) => set('prodDiaPosicao', v)} />
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <SectionTitle label="A — Dados da Matéria Prima" color="#f97316" />
          <div className="space-y-3">
            {['mp1', 'mp2', 'mp3'].map((key, i) => (
              <MPRow
                key={key}
                label={MP_LABELS[i]}
                data={form[key]}
                onChange={(field, val) => setMP(key, field, val)}
                accent={MP_ACCENTS[i]}
              />
            ))}
          </div>

          <SectionTitle label="B — Dados do Produto" color="#22d3ee" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>B1 — Descrição</Label>
              <TextInput value={form.descricao} onChange={(v) => set('descricao', v)} placeholder="ex: 150/48 PES CRU" />
            </div>
            <div>
              <Label>B2 — Código Microdata</Label>
              <TextInput value={form.codigoMicrodata} onChange={(v) => set('codigoMicrodata', v)} placeholder="ex: 109004" mono />
            </div>
            <div>
              <Label>B3 — Título Comercial</Label>
              <TextInput value={form.tituloComercial} onChange={(v) => set('tituloComercial', v)} placeholder="ex: 150DTEX" />
            </div>
            <div>
              <Label>B4 — Título Dtex</Label>
              <NumberInput value={form.tituloDtex} onChange={(v) => set('tituloDtex', v)} />
            </div>
            <div className="col-span-2">
              <Label>B5 — Composição</Label>
              <TextInput value={form.composicao} onChange={(v) => set('composicao', v)} placeholder="ex: 100% PES" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-brand-border">
          <button onClick={onClose} className="px-4 py-2 text-xs text-brand-muted hover:text-white rounded-xl">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={!form.nome || !form.id || loading}
            className="flex items-center gap-1.5 px-5 py-2 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-semibold rounded-xl hover:bg-brand-cyan/20 transition-all disabled:opacity-40">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Salvar produto
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Machine Modal ────────────────────────────────────────────────────────────
function MachineModal({ machine, factory, onSave, onClose }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(machine ?? { id: '', name: '', spindles: 240, efficiency: 95 });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSave(factory, form);
      onClose();
    } catch (e) {
      alert("Erro ao salvar máquina.");
    } finally {
      setLoading(false);
    }
  };

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
            <div><Label>ID</Label><TextInput value={form.id} onChange={(v) => set('id', v)} placeholder="ex: M12" mono /></div>
            <div><Label>Nome</Label><TextInput value={form.name} onChange={(v) => set('name', v)} placeholder="ex: Máquina 12" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Qtde Fusos</Label><NumberInput value={form.spindles} onChange={(v) => set('spindles', v)} /></div>
            <div><Label>Eficiência (%)</Label><NumberInput value={form.efficiency} onChange={(v) => set('efficiency', v)} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-xs text-brand-muted hover:text-white rounded-xl">Cancelar</button>
          <button onClick={handleSubmit} disabled={!form.id || !form.name || loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-semibold rounded-xl hover:bg-brand-cyan/20 transition-all disabled:opacity-40">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ product, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const MPs = [
    { key: 'mp1', label: 'Matéria Prima 1', color: '#22d3ee' },
    { key: 'mp2', label: 'Matéria Prima 2', color: '#f97316' },
    { key: 'mp3', label: 'Matéria Prima 3', color: '#a78bfa' },
  ];
  return (
    <div className="bg-brand-surface/40 border border-brand-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-brand-cyan">{product.id}</span>
            <span className="text-sm font-semibold text-white truncate">{product.nome}</span>
            {product.cliente && <span className="text-xs text-brand-muted hidden sm:block truncate">— {product.cliente}</span>}
          </div>
          <div className="flex items-center gap-4 mt-0.5">
            {product.tituloComercial && <span className="text-[11px] text-brand-muted">{product.tituloComercial}</span>}
            {product.prodDiaPosicao > 0 && <span className="text-[11px] text-brand-muted">{product.prodDiaPosicao} kg/pos/dia</span>}
            {product.composicao && <span className="text-[11px] text-brand-muted">{product.composicao}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setExpanded((v) => !v)} className="p-1.5 text-brand-muted hover:text-brand-cyan hover:bg-brand-cyan/10 rounded-lg transition-all">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button onClick={() => onEdit(product)} className="p-1.5 text-brand-muted hover:text-brand-cyan hover:bg-brand-cyan/10 rounded-lg transition-all"><Pencil size={13} /></button>
          <button onClick={() => onDelete(product.id)} className="p-1.5 text-brand-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={13} /></button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-brand-border/50 px-4 py-4 space-y-4 animate-fade-in">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div><span className="text-brand-muted text-[10px] uppercase tracking-wider block">Cliente</span><span className="text-white font-medium">{product.cliente || '—'}</span></div>
            <div><span className="text-brand-muted text-[10px] uppercase tracking-wider block">Produto</span><span className="text-white font-medium">{product.nome}</span></div>
            <div><span className="text-brand-muted text-[10px] uppercase tracking-wider block">Prod./dia/pos.</span><span className="text-brand-cyan font-mono font-bold">{product.prodDiaPosicao} kg</span></div>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-brand-orange uppercase tracking-widest">A — Matéria Prima</p>
            {MPs.map(({ key, label, color }) => {
              const mp = product[key];
              if (!mp?.descricao) return null;
              return (
                <div key={key} className="bg-brand-bg/50 rounded-lg p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color }}>{label}</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    {[['Descrição', mp.descricao], ['Cód. Microdata', mp.codigoMicrodata], ['Título Dtex', mp.tituloDtex], ['Nº Filamentos', mp.nFilamentos], ['Composição', `${mp.composicaoPct}%`]].map(([k, v]) => v ? (
                      <div key={k} className="flex justify-between text-xs"><span className="text-brand-muted">{k}</span><span className="text-white font-medium">{v}</span></div>
                    ) : null)}
                  </div>
                </div>
              );
            })}
          </div>
          <div>
            <p className="text-[10px] font-bold text-brand-cyan uppercase tracking-widest mb-2">B — Dados do Produto</p>
            <div className="bg-brand-bg/50 rounded-lg p-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
              {[['Descrição', product.descricao], ['Cód. Microdata', product.codigoMicrodata], ['Título Comercial', product.tituloComercial], ['Título Dtex', product.tituloDtex], ['Composição', product.composicao]].map(([k, v]) => v ? (
                <div key={k} className="flex justify-between text-xs"><span className="text-brand-muted">{k}</span><span className="text-white font-medium">{v}</span></div>
              ) : null)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Admin Page ───────────────────────────────────────────────────────────────
export default function Admin() {
  const [tab, setTab] = useState('products');
  const [selectedFactory, setSelectedFactory] = useState('matriz');
  const [modal, setModal] = useState(null);

  // Pegamos as funções e o estado do Zustand
  const { products, machines, setMachines } = useAdminStore();

  const handleSaveProduct = async (form) => {
    await saveProduct(form); // Persiste no Firebase
  };

  const handleSaveMachine = async (factory, form) => {
    await saveMachineConfig(factory, form.id, form); // Persiste no Firebase
    // Atualização manual simples do store local para máquinas (já que não fizemos o subscriber)
    const updatedFactoryMachines = [...(machines[factory] || [])];
    const idx = updatedFactoryMachines.findIndex(m => m.id === form.id);
    if (idx >= 0) updatedFactoryMachines[idx] = form;
    else updatedFactoryMachines.push(form);
    setMachines({ ...machines, [factory]: updatedFactoryMachines });
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm("Deseja realmente excluir este produto?")) {
      await deleteDoc(doc(db, "products", id));
    }
  };

  const handleDeleteMachine = async (factory, id) => {
    if (window.confirm("Deseja excluir esta máquina?")) {
      await deleteDoc(doc(db, "machines_config", `${factory}__${id}`));
      const filtered = machines[factory].filter(m => m.id !== id);
      setMachines({ ...machines, [factory]: filtered });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Cadastros</h1>
        <p className="text-sm text-brand-muted mt-0.5">Configurações de base da produção</p>
      </div>

      <div className="flex gap-1 bg-brand-card border border-brand-border rounded-xl p-1 w-fit mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === id ? 'bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20' : 'text-brand-muted hover:text-white'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-brand-muted">{products.length} produtos cadastrados</p>
            <button onClick={() => setModal({ type: 'product', data: null })}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-semibold rounded-xl hover:bg-brand-cyan/20 transition-all">
              <Plus size={12} /> Novo produto
            </button>
          </div>
          {products.length === 0
            ? <div className="text-center py-12 text-brand-muted text-sm">Nenhum produto no banco de dados</div>
            : products.map((p) => <ProductCard key={p.id} product={p} onEdit={(prod) => setModal({ type: 'product', data: prod })} onDelete={handleDeleteProduct} />)
          }
        </div>
      )}

      {tab === 'machines' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {FACTORIES.map((f) => (
              <button key={f.id} onClick={() => setSelectedFactory(f.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all
                  ${selectedFactory === f.id ? 'border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan' : 'border-brand-border text-brand-muted hover:text-white bg-brand-card'}`}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />{f.name}
              </button>
            ))}
          </div>
          <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
              <h2 className="text-sm font-semibold text-white">
                {FACTORIES.find((f) => f.id === selectedFactory)?.name}
                <span className="text-brand-muted font-normal ml-2">({machines[selectedFactory]?.length || 0})</span>
              </h2>
              <button onClick={() => setModal({ type: 'machine', data: null, factory: selectedFactory })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-semibold rounded-xl hover:bg-brand-cyan/20 transition-all">
                <Plus size={12} /> Nova máquina
              </button>
            </div>
            <table className="w-full">
              <thead><tr className="border-b border-brand-border bg-brand-surface/50">
                {['ID', 'Nome', 'Fusos', 'Eficiência', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-brand-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(machines[selectedFactory] || []).map((m) => (
                  <tr key={m.id} className="border-b border-brand-border/40 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-brand-cyan">{m.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-white">{m.name}</td>
                    <td className="px-4 py-3 text-sm text-brand-muted">{m.spindles}</td>
                    <td className="px-4 py-3 text-sm text-brand-muted">{m.efficiency}%</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setModal({ type: 'machine', data: m, factory: selectedFactory })} className="p-1.5 text-brand-muted hover:text-brand-cyan hover:bg-brand-cyan/10 rounded-lg transition-all"><Pencil size={13} /></button>
                        <button onClick={() => handleDeleteMachine(selectedFactory, m.id)} className="p-1.5 text-brand-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal?.type === 'product' && <ProductModal product={modal.data} onSave={handleSaveProduct} onClose={() => setModal(null)} />}
      {modal?.type === 'machine' && <MachineModal machine={modal.data} factory={modal.factory} onSave={handleSaveMachine} onClose={() => setModal(null)} />}
    </div>
  );
}