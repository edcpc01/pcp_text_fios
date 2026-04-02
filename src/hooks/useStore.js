import { create } from 'zustand';

export const FACTORIES = [
  { id: 'doptex', name: 'Doptex', color: '#0ea5e9' },
  { id: 'corradi', name: 'Corradi', color: '#f59e0b' },
];

export const MACHINES = {
  doptex: [
    { id: 'M01', name: 'Máquina 01', sides: 2, capacity: 450 },
    { id: 'M02', name: 'Máquina 02', sides: 2, capacity: 420 },
    { id: 'M03', name: 'Máquina 03', sides: 2, capacity: 480 },
    { id: 'M04', name: 'Máquina 04', sides: 2, capacity: 400 },
    { id: 'M05', name: 'Máquina 05', sides: 2, capacity: 460 },
    { id: 'M06', name: 'Máquina 06', sides: 2, capacity: 440 },
    { id: 'M07', name: 'Máquina 07', sides: 1, capacity: 380 },
    { id: 'M08', name: 'Máquina 08', sides: 2, capacity: 500 },
    { id: 'M09', name: 'Máquina 09', sides: 2, capacity: 470 },
    { id: 'M10', name: 'Máquina 10', sides: 2, capacity: 430 },
    { id: 'M11', name: 'Máquina 11', sides: 2, capacity: 490 },
  ],
  corradi: [
    { id: 'C01', name: 'Máquina 01', sides: 2, capacity: 400 },
    { id: 'C02', name: 'Máquina 02', sides: 2, capacity: 420 },
    { id: 'C03', name: 'Máquina 03', sides: 2, capacity: 380 },
    { id: 'C04', name: 'Máquina 04', sides: 2, capacity: 450 },
    { id: 'C05', name: 'Máquina 05', sides: 2, capacity: 410 },
    { id: 'C06', name: 'Máquina 06', sides: 1, capacity: 360 },
    { id: 'C07', name: 'Máquina 07', sides: 2, capacity: 440 },
    { id: 'C08', name: 'Máquina 08', sides: 2, capacity: 460 },
  ],
};

export const PRODUCTS = [
  { id: 'P001', name: 'DTY 150/48', dtex: 150, filaments: 48, type: 'DTY' },
  { id: 'P002', name: 'DTY 100/36', dtex: 100, filaments: 36, type: 'DTY' },
  { id: 'P003', name: 'DTY 75/36', dtex: 75, filaments: 36, type: 'DTY' },
  { id: 'P004', name: 'DTY 150/144', dtex: 150, filaments: 144, type: 'DTY' },
  { id: 'P005', name: 'DTY 300/96', dtex: 300, filaments: 96, type: 'DTY' },
  { id: 'P006', name: 'ATY 200/48', dtex: 200, filaments: 48, type: 'ATY' },
  { id: 'P007', name: 'FDY 150/48', dtex: 150, filaments: 48, type: 'FDY' },
  { id: 'P008', name: 'DTY 100/48', dtex: 100, filaments: 48, type: 'DTY' },
  { id: 'P009', name: 'DTY 200/96', dtex: 200, filaments: 96, type: 'DTY' },
  { id: 'P010', name: 'DTY 50/24', dtex: 50, filaments: 24, type: 'DTY' },
];

// Auth Store
export const useAuthStore = create((set) => ({
  user: null,
  loading: true,
  error: null,
  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  logout: () => set({ user: null }),
}));

// App Store
export const useAppStore = create((set, get) => ({
  factory: 'doptex',
  setFactory: (factory) => set({ factory }),
  getFactoryData: () => FACTORIES.find((f) => f.id === get().factory),
  getMachines: () => MACHINES[get().factory] || [],

  month: { year: new Date().getFullYear(), month: new Date().getMonth() },
  setMonth: (month) => set({ month }),
  changeMonth: (dir) =>
    set((state) => {
      let m = state.month.month + dir;
      let y = state.month.year;
      if (m < 0) { m = 11; y--; }
      if (m > 11) { m = 0; y++; }
      return { month: { year: y, month: m } };
    }),
  getYearMonth: () => {
    const { year, month: m } = get().month;
    return `${year}-${String(m + 1).padStart(2, '0')}`;
  },

  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  agentOpen: false,
  toggleAgent: () => set((s) => ({ agentOpen: !s.agentOpen })),
  openAgent: () => set({ agentOpen: true }),
  closeAgent: () => set({ agentOpen: false }),
}));

// Planning Store
export const usePlanningStore = create((set, get) => ({
  entries: [],
  loading: false,
  error: null,
  setEntries: (entries) => set({ entries, loading: false }),
  setLoading: (loading) => set({ loading }),
  addEntry: (entry) => set((s) => ({ entries: [...s.entries, { ...entry, id: entry.id || `local-${Date.now()}` }] })),
  updateEntry: (id, updates) => set((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, ...updates } : e)) })),
  deleteEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
  getEntriesByMachine: (machineId) => get().entries.filter((e) => e.machine === machineId),
  getEntryByMachineDate: (machineId, date) => get().entries.find((e) => e.machine === machineId && e.date === date),
}));

// Production Store
export const useProductionStore = create((set, get) => ({
  records: [],
  loading: false,
  setRecords: (records) => set({ records, loading: false }),
  setLoading: (loading) => set({ loading }),
  addRecords: (newRecords) => set((s) => ({ records: [...s.records, ...newRecords] })),
  getRecordsByProduct: () => {
    const map = {};
    get().records.forEach((r) => {
      if (!map[r.productName]) map[r.productName] = { planned: 0, actual: 0 };
      map[r.productName].actual += r.actual || 0;
      map[r.productName].planned += r.planned || 0;
    });
    return Object.entries(map)
      .map(([name, vals]) => ({ name, ...vals, pct: vals.planned > 0 ? Math.round((vals.actual / vals.planned) * 100) : 0 }))
      .sort((a, b) => b.planned - a.planned);
  },
}));
