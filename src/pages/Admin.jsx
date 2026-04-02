import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Save, Package, Cpu, ChevronDown, ChevronUp } from 'lucide-react';
import { useAdminStore, FACTORIES } from '../hooks/useStore';

const TABS = [
  { id: 'products', label: 'Produtos',  icon: Package },
  { id: 'machines', label: 'Máquinas',  icon: Cpu },
];

const EMPTY_PRODUCT = {
  id: '', cliente: '', nome: '', prodDiaPosicao: 0,
  alma:   { descricao: '', codigoMicrodata: '', tituloDtex: 0, nFilamentos: 0, composicaoPct: 0 },
  efeito: { descricao: '', codigoMicrodata: '', tituloDtex: 0, nFilamentos: 0, composicaoPct: 0 },
  descricao: '', codigoMicrodata: '', tituloComercial: '', tituloDtex: 0,
  composicao: '', comprimentoEnrolamento: 250, diametroMaxBobina: 230,
};

// ─── Field helpers ────────────────────────────────────────────────────────────
function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-bold text-brand-muted mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = 'text', placeholder = '', className = '' }) {
  return (
    <input type={type} value={value ?? ''} onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-brand-bg border border-brand-border rounded-xl px-3 py-2 text-sm text-white placeholder:text-brand-muted/40 focus:outline-none focus:border-brand-cyan/50 transition-all ${className}`} />
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ label, color = '#22d3ee' }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1" style={{ background: `linear-gradient(to right, ${color}40, transparent)` }} />
      <span className="text-xs font-bold uppercase tracking-widest px-1" style={{ color }}>{label}</span>
      <div className="h-px flex-1" style={{ background: `linear-gradient(to left, ${color}40, transparent)` }} />
    </div>
  );
}

// ─── Product Modal ────────────────────────────────────────────────────────────
function ProductModal({ product, onSave, onClose }) {
  const [form, setForm] = useState(product ? { ...EMPTY_PRODUCT, ...product } : { ...EMPTY_PRODUCT, id: `P${String(Date.now()).slice(-3)}` });

  const setAlma   = (k, v) => setForm((f) => ({ ...f, alma:   { ...f.alma,   [k]: v } }));
  const setEfeito = (k, v) => setForm((f) => ({ ...f, efeito: { ...f.efeito, [k]: v } }));

  const handleSave = () => {
    if (!form.nome || !form.id) return;
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-brand-card border border-brand-border rounded-2xl shadow-2xl animate-fade-in my-4">

        {/* Header — imita cabeçalho da ficha técnica */}
        <div className="px-6 pt-5 pb-4 border-b border-brand-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">{product ? 'Editar Produto' : 'Novo Produto'}</h3>
            <button onClick={onClose} className="text-brand-muted hover:text-white p-1 rounded-lg"><X size={15} /></button>
          </div>

          {/* Cabeçalho da ficha */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Cliente">
              <Input value={form.cliente} onChange={(v) => setForm((f) => ({ ...f, cliente: v }))} placeholder="ex: Tecelagem São João" />
            </Field>
            <Field label="Produto / Referência">
              <Input value={form.nome} onChange={(v) => setForm((f) => ({ ...f, nome: v }))} placeholder="ex: DTY 150/48" />
            </Field>
            <Field label="Prod./dia/posição (kg)">
              <Input type="number" value={form.prodDiaPosicao} onChange={(v) => setForm((f) => ({ ...f, prodDiaPosicao: v }))} />
            </Field>
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">

          {/* Seção A — Matéria Prima */}
          <SectionHeader label="A — Dados da Matéria Prima" color="#f97316" />

          <div className="grid grid-cols-2 gap-4">
            {/* Alma */}
            <div className="bg-brand-surface/50 border border-brand-border rounded-xl p-4 space-y-3">
              <p className="text-[11px] font-bold text-brand-cyan uppercase tracking-widest text-center">Alma</p>
              <Field label="A1 — Descrição">
                <Input value={form.alma.descricao} onChange={(v) => setAlma('descricao', v)} placeholder="ex: PES POY 1x150/48" />
              </Field>
              <Field label="A2 — Código Microdata">
                <Input value={form.alma.codigoMicrodata} onChange={(v) => setAlma('codigoMicrodata', v)} placeholder="ex: 100045" />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="A3 — Dtex">
                  <Input type="number" value={form.alma.tituloDtex} onChange={(v) => setAlma('tituloDtex', v)} />
                </Field>
                <Field label="A4 — Filamentos">
                  <Input type="number" value={form.alma.nFilamentos} onChange={(v) => setAlma('nFilamentos', v)} />
                </Field>
                <Field label="A5 — Comp. (%)">
                  <Input type="number" value={form.alma.composicaoPct} onChange={(v) => setAlma('composicaoPct', v)} />
                </Field>
              </div>
            </div>

            {/* Efeito */}
            <div className="bg-brand-surface/50 border border-brand-border rounded-xl p-4 space-y-3">
              <p className="text-[11px] font-bold text-brand-orange uppercase tracking-widest text-center">Efeito</p>
              <Field label="A1 — Descrição">
                <Input value={form.efeito.descricao} onChange={(v) => setEfeito('descricao', v)} placeholder="ex: PA6 POY OP 1x95/72" />
              </Field>
              <Field label="A2 — Código Microdata">
                <Input value={form.efeito.codigoMicrodata} onChange={(v) => setEfeito('codigoMicrodata', v)} placeholder="ex: 103188" />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="A3 — Dtex">
                  <Input type="number" value={form.efeito.tituloDtex} onChange={(v) => setEfeito('tituloDtex', v)} />
                </Field>
                <Field label="A4 — Filamentos">
                  <Input type="number" value={form.efeito.nFilamentos} onChange={(v) => setEfeito('nFilamentos', v)} />
                </Field>
                <Field label="A5 — Comp. (%)">
                  <Input type="number" value={form.efeito.composicaoPct} onChange={(v) => setEfeito('composicaoPct', v)} />
                </Field>
              </div>
            </div>
          </div>

          {/* Seção B — Dados do Produto */}
          <SectionHeader label="B — Dados do Produto" color="#22d3ee" />

          <div className="grid grid-cols-2 gap-3">
            <Field label="B1 — Descrição">
              <Input value={form.descricao} onChange={(v) => setForm((f) => ({ ...f, descricao: v }))} placeholder="ex: 150/48 PES CRU TEXTURIZADO DTY" />
            </Field>
            <Field label="B2 — Código Microdata">
              <Input value={form.codigoMicrodata} onChange={(v) => setForm((f) => ({ ...f, codigoMicrodata: v }))} placeholder="ex: 109004" />
            </Field>
            <Field label="B3 — Título Comercial">
              <Input value={form.tituloComercial} onChange={(v) => setForm((f) => ({ ...f, tituloComercial: v }))} placeholder="ex: 150DTEX" />
            </Field>
            <Field label="B4 — Título Dtex">
              <Input type="number" value={form.tituloDtex} onChange={(v) => setForm((f) => ({ ...f, tituloDtex: v }))} />
            </Field>
            <Field label="B5 — Composição">
              <Input value={form.composicao} onChange={(v) => setForm((f) => ({ ...f, composicao: v }))} placeholder="ex: 56%PA 44%PES" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="B6 — Compr. Enrolamento (mm)">
                <Input type="number" value={form.comprimentoEnrolamento} onChange={(v) => setForm((f) => ({ ...f, comprimentoEnrolamento: v }))} />
              </Field>
              <Field label="B7 — Diâm. Máx. Bobina (mm)">
                <Input type="number" value={form.diametroMaxBobina} onChange={(v) => setForm((f) => ({ ...f, diametroMaxBobina: v }))} />
              </Field>
            </div>
          </div>

          {/* ID interno */}
          <div className="pt-1 border-t border-brand-border/50">
            <Field label="ID interno do produto" className="max-w-xs">
              <Input value={form.id} onChange={(v) => setForm((f) => ({ ...f, id: v }))} placeholder="ex: P001" className="font-mono" />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-xs text-brand-muted hover:text-white rounded-xl transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={!form.nome || !form.id}
            className="flex items-center gap-1.5 px-5 py-2 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-semibold rounded-xl hover:bg-brand-cyan/20 transition-all disabled:opacity-40">
            <Save size={12} /> Salvar produto
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Machine Modal ────────────────────────────────────────────────────────────
function MachineModal({ machine, factory, onSave, onClose }) {
  const [form, setForm] = useState(machine
    ? { ...machine }
    : { id: '', name: '', sides: 2, capacity: 400 }
  );
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
            <Field label="ID">
              <Input value={form.id} onChange={(v) => setForm((f) => ({ ...f, id: v }))} placeholder="ex: M12" className="font-mono" />
            </Field>
            <Field label="Lados">
              <select value={form.sides} onChange={(e) => setForm((f) => ({ ...f, sides: Number(e.target.value) }))}
                className="w-full bg-brand-bg border border-brand-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-cyan/50 transition-all">
                <option value={1}>1 lado</option><option value={2}>2 lados</option>
              </select>
            </Field>
          </div>
          <Field label="Nome">
            <Input value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="ex: Máquina 12" />
          </Field>
          <Field label="Capacidade (kg/dia)">
            <Input type="number" value={form.capacity} onChange={(v) => setForm((f) => ({ ...f, capacity: v }))} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-xs text-brand-muted hover:text-white rounded-xl transition-colors">Cancelar</button>
          <button onClick={() => { onSave(factory, form); onClose(); }} disabled={!form.id || !form.name}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-semibold rounded-xl hover:bg-brand-cyan/20 transition-all disabled:opacity-40">
            <Save size={12} /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Product Card (expanded view) ─────────────────────────────────────────────
function ProductCard({ product, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-brand-surface/40 border border-brand-border rounded-xl overflow-hidden">
      {/* Summary row */}
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
          <button onClick={() => setExpanded((v) => !v)}
            className="p-1.5 text-brand-muted hover:text-brand-cyan hover:bg-brand-cyan/10 rounded-lg transition-all">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button onClick={() => onEdit(product)} className="p-1.5 text-brand-muted hover:text-brand-cyan hover:bg-brand-cyan/10 rounded-lg transition-all">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(product.id)} className="p-1.5 text-brand-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Expanded detail — ficha técnica style */}
      {expanded && (
        <div className="border-t border-brand-border/50 px-4 py-4 space-y-4 animate-fade-in">
          {/* Header info */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div><span className="text-brand-muted uppercase tracking-wider text-[10px] block">Cliente</span><span className="text-white font-medium">{product.cliente || '—'}</span></div>
            <div><span className="text-brand-muted uppercase tracking-wider text-[10px] block">Produto</span><span className="text-white font-medium">{product.nome}</span></div>
            <div><span className="text-brand-muted uppercase tracking-wider text-[10px] block">Prod./dia/posição</span><span className="text-brand-cyan font-mono font-bold">{product.prodDiaPosicao} kg</span></div>
          </div>

          {/* Seção A */}
          <div>
            <p className="text-[10px] font-bold text-brand-orange uppercase tracking-widest mb-2">A — Dados da Matéria Prima</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'ALMA', data: product.alma, color: 'text-brand-cyan' },
                { label: 'EFEITO', data: product.efeito, color: 'text-brand-orange' },
              ].map(({ label, data, color }) => data?.descricao ? (
                <div key={label} className="bg-brand-bg/50 rounded-lg p-3 space-y-1.5">
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${color}`}>{label}</p>
                  {[
                    ['Descrição', data.descricao],
                    ['Cód. Microdata', data.codigoMicrodata],
                    ['Título Dtex', data.tituloDtex],
                    ['Nº Filamentos', data.nFilamentos],
                    ['Composição', `${data.composicaoPct}%`],
                  ].map(([k, v]) => v ? (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-brand-muted">{k}</span>
                      <span className="text-white font-medium">{v}</span>
                    </div>
                  ) : null)}
                </div>
              ) : null)}
            </div>
          </div>

          {/* Seção B */}
          <div>
            <p className="text-[10px] font-bold text-brand-cyan uppercase tracking-widest mb-2">B — Dados do Produto</p>
            <div className="bg-brand-bg/50 rounded-lg p-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
              {[
                ['Descrição', product.descricao],
                ['Cód. Microdata', product.codigoMicrodata],
                ['Título Comercial', product.tituloComercial],
                ['Título Dtex', product.tituloDtex],
                ['Composição', product.composicao],
                ['Compr. Enrolamento', product.comprimentoEnrolamento ? `${product.comprimentoEnrolamento} mm` : ''],
                ['Diâm. Máx. Bobina',  product.diametroMaxBobina    ? `${product.diametroMaxBobina} mm`    : ''],
              ].map(([k, v]) => v ? (
                <div key={k} className="flex justify-between text-xs">
                  <span className="text-brand-muted">{k}</span>
                  <span className="text-white font-medium">{v}</span>
                </div>
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
  const { products, machines, addProduct, updateProduct, deleteProduct, addMachine, updateMachine, deleteMachine } = useAdminStore();

  const handleSaveProduct = (form) => {
    if (products.find((p) => p.id === form.id)) updateProduct(form.id, form);
    else addProduct(form);
  };

  const handleSaveMachine = (factory, form) => {
    if (machines[factory]?.find((m) => m.id === form.id)) updateMachine(factory, form.id, form);
    else addMachine(factory, form);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Cadastros</h1>
        <p className="text-sm text-brand-muted mt-0.5">Acesso restrito a administradores</p>
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

      {/* Products */}
      {tab === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-brand-muted">{products.length} produto{products.length !== 1 ? 's' : ''} cadastrado{products.length !== 1 ? 's' : ''}</p>
            <button onClick={() => setModal({ type: 'product', data: null })}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-xs font-semibold rounded-xl hover:bg-brand-cyan/20 transition-all">
              <Plus size={12} /> Novo produto
            </button>
          </div>
          <div className="space-y-2">
            {products.length === 0 ? (
              <div className="text-center py-12 text-brand-muted text-sm">Nenhum produto cadastrado</div>
            ) : products.map((p) => (
              <ProductCard key={p.id} product={p}
                onEdit={(prod) => setModal({ type: 'product', data: prod })}
                onDelete={deleteProduct} />
            ))}
          </div>
        </div>
      )}

      {/* Machines */}
      {tab === 'machines' && (
        <div className="space-y-4">
          <div className="flex gap-2 mb-2">
            {FACTORIES.map((f) => (
              <button key={f.id} onClick={() => setSelectedFactory(f.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all
                  ${selectedFactory === f.id ? 'border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan' : 'border-brand-border text-brand-muted hover:text-white bg-brand-card'}`}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} /> {f.name}
              </button>
            ))}
          </div>
          <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
              <h2 className="text-sm font-semibold text-white">
                {FACTORIES.find((f) => f.id === selectedFactory)?.name}
                <span className="text-brand-muted font-normal ml-2">({machines[selectedFactory]?.length || 0} máquinas)</span>
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
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-brand-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(machines[selectedFactory] || []).map((m) => (
                  <tr key={m.id} className="border-b border-brand-border/40 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-brand-cyan">{m.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-white">{m.name}</td>
                    <td className="px-4 py-3 text-sm text-brand-muted">{m.sides}</td>
                    <td className="px-4 py-3 text-sm font-mono text-brand-muted">{m.capacity}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setModal({ type: 'machine', data: m, factory: selectedFactory })}
                          className="p-1.5 text-brand-muted hover:text-brand-cyan hover:bg-brand-cyan/10 rounded-lg transition-all"><Pencil size={13} /></button>
                        <button onClick={() => deleteMachine(selectedFactory, m.id)}
                          className="p-1.5 text-brand-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal?.type === 'product' && (
        <ProductModal product={modal.data} onSave={handleSaveProduct} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'machine' && (
        <MachineModal machine={modal.data} factory={modal.factory} onSave={handleSaveMachine} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
