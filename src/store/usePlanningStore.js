import { create } from 'zustand';
import { db } from '../services/firebase'; // Verifique se seu arquivo de config chama 'firebase.js' ou 'firebase-config.js'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

export const usePlanningStore = create((set, get) => ({
    // Estado para os Cadastros Base
    products: [],
    machines: [],
    loading: false,

    // Estado para a Grade de Planejamento
    entriesMap: {}, // Chave: factory__machine__date

    // --- AÇÕES DE CADASTRO ---
    setProducts: (products) => set({ products }),
    setMachines: (machines) => set({ machines }),

    // --- AÇÕES DE PLANEJAMENTO ---
    upsertEntry: (factory, machine, date, data) => {
        const id = `${factory}__${machine}__${date}`;
        set((state) => ({
            entriesMap: {
                ...state.entriesMap,
                [id]: { ...state.entriesMap[id], ...data, factory, machine, date }
            }
        }));
    },

    // Facilitador para transformar o objeto entriesMap em Array para gráficos/tabelas
    getEntriesAsArray: () => Object.values(get().entriesMap),
}));