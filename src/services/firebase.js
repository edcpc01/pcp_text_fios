import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection, doc, getDoc, setDoc, deleteDoc,
  query, where, orderBy, onSnapshot, Timestamp,
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore';
import {
  getAuth, signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged,
} from 'firebase/auth';
import { makeEntryId } from '../hooks/useStore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Firebase 10 — usa initializeFirestore com persistentLocalCache
// em vez do deprecated enableIndexedDbPersistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const auth = getAuth(app);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const signIn = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export const signOut = () => firebaseSignOut(auth);
export const onAuthChange = (cb) => onAuthStateChanged(auth, cb);

export async function getUserRole(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) return snap.data().role || 'planner';
    // Documento não existe — cria automaticamente como planner
    await setDoc(doc(db, 'users', uid), { role: 'planner', createdAt: Timestamp.now() }, { merge: true });
    return 'planner';
  } catch (err) {
    console.warn('[Firebase] getUserRole falhou:', err.message);
    return 'planner';
  }
}

// ─── Planning ─────────────────────────────────────────────────────────────────
export function subscribePlanningEntries(factory, yearMonth, callback) {
  const [year, month] = yearMonth.split('-').map(Number);
  const start = Timestamp.fromDate(new Date(year, month - 1, 1));
  const end   = Timestamp.fromDate(new Date(year, month, 0, 23, 59, 59));

  // Filtra apenas por date (usa índice de campo único auto-criado pelo Firestore).
  // O filtro de factory é feito no cliente para evitar índice composto não implantado.
  const q = query(
    collection(db, 'planning_entries'),
    where('date', '>=', start),
    where('date', '<=', end),
  );
  return onSnapshot(
    q,
    (snap) => {
      const data = snap.docs
        .map((d) => ({
          ...d.data(),
          id: d.id,
          date: d.data().date?.toDate?.()?.toISOString?.()?.split('T')[0],
        }))
        .filter((e) => e.factory === factory)          // ← filtro de fábrica no cliente
        .sort((a, b) => (a.date < b.date ? -1 : 1));   // ← ordenação no cliente
      console.log(`[Firestore] planning_entries snapshot: ${data.length} docs (factory=${factory})`);
      callback(data);
    },
    (err) => {
      console.error('[Firestore] subscribePlanningEntries error:', err.code, err.message);
    }
  );
}

export async function savePlanningEntry(entry) {
  const stableId = makeEntryId(entry.factory, entry.machine, entry.date);
  const data = {
    factory: entry.factory,
    machine: entry.machine,
    machineName: entry.machineName || entry.machine,
    product: entry.product || '',
    productName: entry.productName || '',
    date: Timestamp.fromDate(new Date(entry.date + 'T12:00:00')),
    planned: Number(entry.planned) || 0,
    quality: entry.quality || 'A',
    side: entry.side || 'Lado A',
    cellType: entry.cellType || 'producao',
    updatedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
  };
  console.log('[Firestore] savePlanningEntry ->', stableId, data.cellType, data.planned);
  await setDoc(doc(db, 'planning_entries', stableId), data, { merge: true });
  console.log('[Firestore] save OK:', stableId);
  return stableId;
}

export async function deletePlanningEntry(id) {
  await deleteDoc(doc(db, 'planning_entries', id));
}

// ─── Production ───────────────────────────────────────────────────────────────
export function subscribeProductionRecords(factory, yearMonth, callback) {
  const [year, month] = yearMonth.split('-').map(Number);
  const start = Timestamp.fromDate(new Date(year, month - 1, 1));
  const end   = Timestamp.fromDate(new Date(year, month, 0, 23, 59, 59));

  // Mesmo padrão: filtra só por date para evitar índice composto.
  // O filtro de factory é feito no cliente.
  const q = query(
    collection(db, 'production_records'),
    where('date', '>=', start),
    where('date', '<=', end),
  );
  return onSnapshot(
    q,
    (snap) => {
      const data = snap.docs
        .map((d) => ({
          ...d.data(),
          id: d.id,
          date: d.data().date?.toDate?.()?.toISOString?.()?.split('T')[0],
        }))
        .filter((r) => r.factory === factory)          // ← filtro de fábrica no cliente
        .sort((a, b) => (a.date < b.date ? -1 : 1));   // ← ordenação no cliente
      console.log(`[Firestore] production_records snapshot: ${data.length} docs (factory=${factory})`);
      callback(data);
    },
    (err) => console.error('[Firestore] subscribeProductionRecords error:', err.code, err.message)
  );
}

export async function saveAgentLog(log) {
  await setDoc(doc(collection(db, 'agent_logs')), { ...log, timestamp: Timestamp.now() });
}

export default app;

// ─── Raw Material Stock (Microdata) ───────────────────────────────────────────

/**
 * Escuta estoque de matéria-prima (coleção microdata_stock) em tempo real.
 * Cada doc: { codigoMicrodata: string, descricao: string, estoqueKg: number }
 */
export const subscribeRawMaterialStock = (callback) => {
  return onSnapshot(collection(db, 'microdata_stock'), (snapshot) => {
    const data = {};
    snapshot.docs.forEach((d) => {
      data[d.id] = { id: d.id, ...d.data() };
    });
    callback(data);
  }, (err) => console.error('[Firestore] subscribeRawMaterialStock error:', err.code));
};

/**
 * Salva ou atualiza o estoque de uma matéria-prima.
 * @param {string} codigoMicrodata - Chave primária (código do item no Microdata)
 * @param {Object} payload - { descricao, estoqueKg, unidade? }
 */
export const saveRawMaterialStock = async (codigoMicrodata, payload) => {
  const docRef = doc(db, 'microdata_stock', codigoMicrodata);
  await setDoc(docRef, { codigoMicrodata, ...payload, updatedAt: Timestamp.now() }, { merge: true });
};

// ─── Finished Goods Stock (Produto Acabado) ────────────────────────────────────

/**
 * Escuta estoque de produto acabado em tempo real.
 * Cada doc: { productId: string, productName: string, estoqueKg: number }
 */
export const subscribeFinishedGoodsStock = (callback) => {
  return onSnapshot(collection(db, 'finished_goods_stock'), (snapshot) => {
    const data = {};
    snapshot.docs.forEach((d) => {
      data[d.id] = { id: d.id, ...d.data() };
    });
    callback(data);
  }, (err) => console.error('[Firestore] subscribeFinishedGoodsStock error:', err.code));
};

/**
 * Salva ou atualiza o estoque de um produto acabado.
 * @param {string} productId - ID do produto (mesmo id da coleção products)
 * @param {Object} payload - { productName, estoqueKg }
 */
export const saveFinishedGoodStock = async (productId, payload) => {
  const docRef = doc(db, 'finished_goods_stock', productId);
  await setDoc(docRef, { productId, ...payload, updatedAt: Timestamp.now() }, { merge: true });
};
// --- CADASTRO DE PRODUTOS (DOPTEX) ---

/**
 * Salva ou atualiza um produto no Firestore
 * @param {Object} product - Objeto com nome, cor, etc.
 */
export const saveProduct = async (product) => {
  // Usa o ID existente ou gera um baseado no timestamp para evitar colisões
  const productId = product.id || `P${Date.now()}`;
  const docRef = doc(db, "products", productId);

  return await setDoc(docRef, {
    ...product,
    id: productId,
    updatedAt: new Date().toISOString()
  }, { merge: true });
};

/**
 * Escuta mudanças na coleção de produtos em tempo real
 * @param {Function} callback - Função que recebe a lista de produtos
 */
export const subscribeProducts = (callback) => {
  // Sem orderBy para evitar necessidade de índice composto no Firestore.
  // A ordenação é feita no cliente.
  return onSnapshot(
    collection(db, 'products'),
    (snapshot) => {
      const products = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
      console.log(`[Firestore] products snapshot: ${products.length} docs`);
      callback(products);
    },
    (err) => {
      console.error('[Firestore] subscribeProducts error:', err.code, err.message);
    }
  );
};

/**
 * Salva a configuração de uma máquina
 */
export async function saveMachineConfig(factory, machineId, config) {
  const docRef = doc(db, 'machines_config', `${factory}__${machineId}`);
  await setDoc(docRef, { ...config, factory, updatedAt: new Date().toISOString() }, { merge: true });
}

/**
 * Escuta máquinas em tempo real. Se vazio, popula com os defaults do Zustand.
 */
export const subscribeMachines = (callback) => {
  return onSnapshot(collection(db, "machines_config"), async (snapshot) => {
    if (snapshot.empty) {
       // Populate defaults to DB once
       const { MACHINES } = await import('../hooks/useStore');
       Object.entries(MACHINES).forEach(([factory, list]) => {
         list.forEach(m => {
            setDoc(doc(db, 'machines_config', `${factory}__${m.id}`), { ...m, factory }, { merge: true });
         });
       });
       return;
    }
    const nextMachines = { matriz: [], filial: [] };
    snapshot.docs.forEach(doc => {
       const m = doc.data();
       if (!nextMachines[m.factory]) nextMachines[m.factory] = [];
       nextMachines[m.factory].push(m);
    });
    Object.keys(nextMachines).forEach(k => nextMachines[k].sort((a,b) => a.id.localeCompare(b.id)));
    callback(nextMachines);
  });
};