import { create } from 'zustand';

export const FACTORIES = [
  { id: 'all',    name: 'Todas as Unidades', color: '#8b5cf6' },
  { id: 'matriz', name: 'Corradi Matriz',    color: '#22d3ee' },
  { id: 'filial', name: 'Corradi Filial',    color: '#f97316' },
];

export const MACHINES = {
  matriz: [
    { id: 'M01', name: 'Máquina 01', spindles: 240, efficiency: 95 },
    { id: 'M02', name: 'Máquina 02', spindles: 240, efficiency: 95 },
    { id: 'M03', name: 'Máquina 03', spindles: 240, efficiency: 95 },
    { id: 'M04', name: 'Máquina 04', spindles: 240, efficiency: 95 },
    { id: 'M05', name: 'Máquina 05', spindles: 240, efficiency: 95 },
    { id: 'M06', name: 'Máquina 06', spindles: 240, efficiency: 95 },
    { id: 'M07', name: 'Máquina 07', spindles: 120, efficiency: 95 },
    { id: 'M08', name: 'Máquina 08', spindles: 240, efficiency: 95 },
    { id: 'M09', name: 'Máquina 09', spindles: 240, efficiency: 95 },
    { id: 'M10', name: 'Máquina 10', spindles: 240, efficiency: 95 },
    { id: 'M11', name: 'Máquina 11', spindles: 240, efficiency: 95 },
  ],
  filial: [
    { id: 'C01', name: 'Máquina 01', spindles: 240, efficiency: 95 },
    { id: 'C02', name: 'Máquina 02', spindles: 240, efficiency: 95 },
    { id: 'C03', name: 'Máquina 03', spindles: 240, efficiency: 95 },
    { id: 'C04', name: 'Máquina 04', spindles: 240, efficiency: 95 },
    { id: 'C05', name: 'Máquina 05', spindles: 240, efficiency: 95 },
    { id: 'C06', name: 'Máquina 06', spindles: 120, efficiency: 95 },
    { id: 'C07', name: 'Máquina 07', spindles: 240, efficiency: 95 },
    { id: 'C08', name: 'Máquina 08', spindles: 240, efficiency: 95 },
  ],
};

// Produto com estrutura completa do ficha técnica
export const PRODUCTS = [
  {
    id: '109001',
    cliente: 'Corradi',
    nome: 'DTY 150/48',
    prodDiaPosicao: 16.24,
    // Seção A — Matéria Prima
    alma: {
      descricao: 'PES POY 1x150/48',
      codigoMicrodata: '100001',
      tituloDtex: 150,
      nFilamentos: 48,
      composicaoPct: 100,
    },
    efeito: {
      descricao: '',
      codigoMicrodata: '',
      tituloDtex: 0,
      nFilamentos: 0,
      composicaoPct: 0,
    },
    // Seção B — Dados do Produto
    descricao: '150/48 PES CRU TEXTURIZADO DTY',
    codigoMicrodata: '109001',
    tituloComercial: '150DTEX',
    tituloDtex: 150,
    composicao: '100% PES',
    comprimentoEnrolamento: 250,
    diametroMaxBobina: 230,
  },
];

export const CELL_TYPES = {
  producao:   { id: 'producao',   label: 'Produção',              color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)',  text: '#6ee7b7' },
  parada_np:  { id: 'parada_np',  label: 'Parada Não Programada', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)',   text: '#fca5a5' },
  parada_p:   { id: 'parada_p',   label: 'Parada Programada',     color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.35)',  text: '#fdba74' },
  manutencao: { id: 'manutencao', label: 'Manutenção Preventiva', color: '#22d3ee', bg: 'rgba(34,211,238,0.12)',  border: 'rgba(34,211,238,0.35)',  text: '#67e8f9' },
};

export function makeEntryId(factory, machine, date, twist) {
  const base = `${factory}__${machine}__${date}`;
  return twist ? `${base}__${twist}` : base;
}

// ─── Twist-split logic ────────────────────────────────────────────────────────
// A divisão de fusos por cabos só vale para RPR TEXTRIZADORA CONV. SINGLE.
// Demais máquinas usam sempre o total de fusos, independente do nº de cabos.
export function parseCabos(productName) {
  if (!productName) return null;
  const m = String(productName).match(/(\d)\s*[xX×]/);
  return m ? Number(m[1]) : null;
}

export function isSplitMachine(machine) {
  return !!machine?.name && /SINGLE/i.test(machine.name);
}

// Fusos que contribuem para a produção de UM produto específico.
export function spindlesForProduct(machine, cabos) {
  const total = machine?.spindles || 0;
  if (!total) return 0;
  if (!isSplitMachine(machine)) return total;
  if (cabos === 2) return Math.floor(total / 2);
  if (cabos === 3) return Math.floor(total / 3);
  return total; // 1 cabo (ou desconhecido) → máquina inteira
}

export function hasTwistMark(productName) {
  return !!productName && /"\s*[SZ]\s*"/i.test(String(productName));
}

export function isTwistSplit(machine, cabos, productName) {
  return isSplitMachine(machine)
    && (cabos === 1 || cabos === 3)
    && hasTwistMark(productName);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const useAuthStore = create((set) => ({
  user: null, loading: true, error: null,
  setUser:    (user)    => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  setError:   (error)   => set({ error, loading: false }),
  logout:     ()        => set({ user: null }),
}));

// ─── App ──────────────────────────────────────────────────────────────────────
export const useAppStore = create((set, get) => ({
  factory: 'all',
  setFactory: (f) => set({ factory: f }),
  getFactoryData: () => FACTORIES.find((f) => f.id === get().factory),
  month: { year: new Date().getFullYear(), month: new Date().getMonth() },
  changeMonth: (dir) => set((s) => {
    let m = s.month.month + dir, y = s.month.year;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    return { month: { year: y, month: m } };
  }),
  getYearMonth: () => {
    const { year, month: m } = get().month;
    return `${year}-${String(m + 1).padStart(2, '0')}`;
  },
  agentOpen: false,
  toggleAgent: () => set((s) => ({ agentOpen: !s.agentOpen })),
  closeAgent:  () => set({ agentOpen: false }),
}));

// ─── Planning ─────────────────────────────────────────────────────────────────
export const usePlanningStore = create((set, get) => ({
  entriesMap: {},
  loading: false,
  setLoading: (loading) => set({ loading }),
  setEntriesFromArray: (arr) => {
    const map = {};
    arr.forEach((e) => { const id = e.id || makeEntryId(e.factory, e.machine, e.date); map[id] = { ...e, id }; });
    set({ entriesMap: map, loading: false });
  },
  upsertEntry: (entry) => set((s) => ({ entriesMap: { ...s.entriesMap, [entry.id]: entry } })),
  deleteEntry: (id) => set((s) => { const n = { ...s.entriesMap }; delete n[id]; return { entriesMap: n }; }),
  getEntries: () => Object.values(get().entriesMap),
}));

// ─── Production ───────────────────────────────────────────────────────────────
export const useProductionStore = create((set, get) => ({
  records: [], loading: false,
  setRecords:  (records) => set({ records, loading: false }),
  setLoading:  (loading) => set({ loading }),
}));

// ─── Admin ────────────────────────────────────────────────────────────────────
export const useAdminStore = create((set) => ({
  products: [],  // Sempre carregado do Firebase via subscribeProducts em App.jsx
  machines: JSON.parse(JSON.stringify(MACHINES)),
  setProducts:   (data)         => set({ products: data }),
  setMachines:   (data)         => set({ machines: data }),
  addProduct:    (p)            => set((s) => ({ products: [...s.products, p] })),
  updateProduct: (id, upd)      => set((s) => ({ products: s.products.map((p) => p.id === id ? { ...p, ...upd } : p) })),
  deleteProduct: (id)           => set((s) => ({ products: s.products.filter((p) => p.id !== id) })),
  addMachine:    (fac, m)       => set((s) => ({ machines: { ...s.machines, [fac]: [...(s.machines[fac] || []), m] } })),
  updateMachine: (fac, id, upd) => set((s) => ({ machines: { ...s.machines, [fac]: s.machines[fac].map((m) => m.id === id ? { ...m, ...upd } : m) } })),
  deleteMachine: (fac, id)      => set((s) => ({ machines: { ...s.machines, [fac]: s.machines[fac].filter((m) => m.id !== id) } })),
}));

// ─── Shared CSV store (qualidade rows — shared by Production, Qualidade, OEE) ──
export const useCsvStore = create((set) => ({
  rows:        [],
  fileName:    null,
  lastSync:    null,
  setRows:     (rows)     => set({ rows }),
  setFileName: (fileName) => set({ fileName }),
  setLastSync: (lastSync) => set({ lastSync }),
}));
