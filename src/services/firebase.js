import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore,
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, where, orderBy, onSnapshot, Timestamp,
  initializeFirestore, memoryLocalCache, writeBatch,
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  getRedirectResult,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { makeEntryId } from '../hooks/useStore';

// ─── Defensive config check ───────────────────────────────────────────────────
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
if (!apiKey || apiKey === 'your_api_key_here') {
  console.error('[Firebase] VITE_FIREBASE_API_KEY não configurada. Dados não serão persistidos.');
}

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
});

export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const signIn             = (email, pw) => signInWithEmailAndPassword(auth, email, pw);

// Usa popup em todos os contextos (Android PWA abre Chrome Custom Tab corretamente).
// Se popup for bloqueado (iOS standalone), a mensagem de erro orientará o usuário.
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

// Mantido para capturar qualquer redirect pendente de sessões anteriores
export const getGoogleRedirectResult = () => getRedirectResult(auth);
export const registerWithEmail  = (email, pw)  => createUserWithEmailAndPassword(auth, email, pw);
export const sendPasswordReset  = (email)      => sendPasswordResetEmail(auth, email);
export const signOut            = ()           => firebaseSignOut(auth);
export const onAuthChange       = (cb)         => onAuthStateChanged(auth, cb);

// firebaseUser: objeto completo do Firebase Auth (tem .email, .displayName)
export async function getUserRole(uid, firebaseUser = null) {
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);

    // Sempre sincroniza name/email do Firebase Auth → Firestore
    const derivedName  = firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || '';
    const derivedEmail = firebaseUser?.email || '';

    if (snap.exists()) {
      const data = snap.data();
      // Sobrescreve name/email com os valores do Auth (Google sempre tem esses campos)
      const updates = {};
      if (derivedName  && data.name  !== derivedName)  updates.name  = derivedName;
      if (derivedEmail && data.email !== derivedEmail) updates.email = derivedEmail;
      if (Object.keys(updates).length > 0) {
        await setDoc(ref, updates, { merge: true });
      }
      return data.role || 'planner';
    }

    // Documento não existe — cria com todos os dados disponíveis
    await setDoc(ref, { role: 'planner', factory: 'all', createdAt: Timestamp.now(), name: derivedName, email: derivedEmail });
    return 'planner';
  } catch (err) {
    console.warn('[Firebase] getUserRole failed:', err.message);
    return 'planner';
  }
}

// ─── User Management (admin only) ────────────────────────────────────────────
export function subscribeUsers(callback) {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
    (err) => console.error('[Firestore] subscribeUsers:', err.code),
  );
}

export async function updateUserRole(uid, role) {
  await setDoc(doc(db, 'users', uid), { role }, { merge: true });
}

export async function updateUserName(uid, name) {
  await setDoc(doc(db, 'users', uid), { name }, { merge: true });
}

export async function updateUserEmail(uid, email) {
  await setDoc(doc(db, 'users', uid), { email }, { merge: true });
}

export async function createUserByAdmin(email, password, name, role) {
  // Usa app secundário para NÃO deslogar o admin durante a criação
  const secondaryApp = initializeApp(firebaseConfig, `admin-create-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);

    // Define displayName no Firebase Auth (facilita recuperação posterior)
    await updateProfile(cred.user, { displayName: name });

    // Salva perfil completo no Firestore usando o db do admin (app principal)
    await setDoc(doc(db, 'users', cred.user.uid), {
      email,
      name,
      role,
      factory: 'all',
      createdAt: Timestamp.now(),
    });

    await firebaseSignOut(secondaryAuth);
    return cred.user;
  } finally {
    await deleteApp(secondaryApp);
  }
}

// ─── Planning Entries ─────────────────────────────────────────────────────────
export function subscribePlanningEntries(factory, yearMonth, callback) {
  const [year, month] = yearMonth.split('-').map(Number);
  const start = Timestamp.fromDate(new Date(year, month - 1, 1));
  const end   = Timestamp.fromDate(new Date(year, month, 0, 23, 59, 59));

  // Handle 'all' factory — subscribe to both and merge
  if (factory === 'all') {
    let matrizData = [];
    let filialData = [];
    const merge = () => callback([...matrizData, ...filialData]);

    const qM = query(collection(db, 'planning_entries'), where('factory', '==', 'matriz'), where('date', '>=', start), where('date', '<=', end), orderBy('date', 'asc'));
    const qF = query(collection(db, 'planning_entries'), where('factory', '==', 'filial'), where('date', '>=', start), where('date', '<=', end), orderBy('date', 'asc'));

    const unsubM = onSnapshot(qM, (snap) => {
      matrizData = snap.docs.map((d) => ({ ...d.data(), id: d.id, date: d.data().date?.toDate?.()?.toISOString?.()?.split('T')[0] }));
      merge();
    }, (err) => console.error('[Firestore] planning all/matriz:', err.code));

    const unsubF = onSnapshot(qF, (snap) => {
      filialData = snap.docs.map((d) => ({ ...d.data(), id: d.id, date: d.data().date?.toDate?.()?.toISOString?.()?.split('T')[0] }));
      merge();
    }, (err) => console.error('[Firestore] planning all/filial:', err.code));

    return () => { unsubM(); unsubF(); };
  }

  const q = query(
    collection(db, 'planning_entries'),
    where('factory', '==', factory),
    where('date', '>=', start),
    where('date', '<=', end),
    orderBy('date', 'asc'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id, date: d.data().date?.toDate?.()?.toISOString?.()?.split('T')[0] })));
  }, (err) => console.error('[Firestore] subscribePlanningEntries:', err.code, err.message));
}

export async function savePlanningEntry(entry) {
  const stableId = entry.id || makeEntryId(entry.factory, entry.machine, entry.date, entry.twist);
  const data = {
    factory:     entry.factory,
    machine:     entry.machine,
    machineName: entry.machineName || entry.machine,
    product:     entry.product     || '',
    productName: entry.productName || '',
    date:        Timestamp.fromDate(new Date(entry.date + 'T12:00:00')),
    planned:     Number(entry.planned) || 0,
    cellType:    entry.cellType    || 'producao',
    twist:       entry.twist       || null,
    updatedAt:   Timestamp.now(),
    createdAt:   Timestamp.now(),
  };
  await setDoc(doc(db, 'planning_entries', stableId), data, { merge: true });
  return stableId;
}

export async function deletePlanningEntry(id) {
  await deleteDoc(doc(db, 'planning_entries', id));
}

// ─── Production Records ───────────────────────────────────────────────────────
export function subscribeProductionRecords(factory, yearMonth, callback) {
  const [year, month] = yearMonth.split('-').map(Number);
  const start = Timestamp.fromDate(new Date(year, month - 1, 1));
  const end   = Timestamp.fromDate(new Date(year, month, 0, 23, 59, 59));

  if (factory === 'all') {
    let matrizData = [], filialData = [];
    const merge = () => callback([...matrizData, ...filialData]);
    const qM = query(collection(db, 'production_records'), where('factory', '==', 'matriz'), where('date', '>=', start), where('date', '<=', end), orderBy('date', 'asc'));
    const qF = query(collection(db, 'production_records'), where('factory', '==', 'filial'), where('date', '>=', start), where('date', '<=', end), orderBy('date', 'asc'));
    const unsubM = onSnapshot(qM, (snap) => { matrizData = snap.docs.map((d) => ({ ...d.data(), id: d.id, date: d.data().date?.toDate?.()?.toISOString?.()?.split('T')[0] })); merge(); });
    const unsubF = onSnapshot(qF, (snap) => { filialData = snap.docs.map((d) => ({ ...d.data(), id: d.id, date: d.data().date?.toDate?.()?.toISOString?.()?.split('T')[0] })); merge(); });
    return () => { unsubM(); unsubF(); };
  }

  const q = query(
    collection(db, 'production_records'),
    where('factory', '==', factory),
    where('date', '>=', start),
    where('date', '<=', end),
    orderBy('date', 'asc'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id, date: d.data().date?.toDate?.()?.toISOString?.()?.split('T')[0] })));
  }, (err) => console.error('[Firestore] subscribeProductionRecords:', err.code));
}

// ─── Products (Admin — persisted to Firestore) ────────────────────────────────
export function subscribeProducts(callback) {
  return onSnapshot(
    collection(db, 'products'),
    (snap) => callback(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
    (err)  => console.error('[Firestore] subscribeProducts:', err.code),
  );
}

export async function saveProduct(product) {
  // Se for um novo produto (sem ID) ou se o ID atual for um código temp "Pxxx",
  // tentamos usar o codigoMicrodata como ID oficial para limpar a base.
  let id = product.id;
  const isTempId = !id || String(id).startsWith('P');
  
  if (isTempId && product.codigoMicrodata) {
    id = String(product.codigoMicrodata).trim();
  }
  
  if (!id) {
    id = `P${String(Date.now()).slice(-5)}`;
  }

  await setDoc(doc(db, 'products', id), { ...product, id, updatedAt: Timestamp.now() }, { merge: true });
  return id;
}

// ─── Machines Config (Admin — persisted to Firestore) ─────────────────────────
export function subscribeMachines(callback) {
  return onSnapshot(
    collection(db, 'machines_config'),
    (snap) => {
      // Reconstruct { matriz: [...], filial: [...] }
      const map = { matriz: [], filial: [] };
      snap.docs.forEach((d) => {
        const data = d.data();
        const factory = data.factory;
        if (factory && map[factory]) map[factory].push({ ...data, id: data.machineId || d.id.split('__')[1] || d.id });
      });
      // Sort by ID
      map.matriz.sort((a, b) => a.id.localeCompare(b.id));
      map.filial.sort((a, b) => a.id.localeCompare(b.id));
      callback(map);
    },
    (err) => console.error('[Firestore] subscribeMachines:', err.code),
  );
}

export async function saveMachineConfig(factory, machineId, data) {
  const docId = `${factory}__${machineId}`;
  await setDoc(doc(db, 'machines_config', docId), { ...data, factory, machineId, updatedAt: Timestamp.now() }, { merge: true });
}

// ─── Raw Material Stock ───────────────────────────────────────────────────────
export function subscribeRawMaterialStock(callback) {
  return onSnapshot(
    collection(db, 'raw_material_stock'),
    (snap) => {
      const map = {};
      snap.docs.forEach((d) => { map[d.id] = { ...d.data() }; });
      callback(map);
    },
    (err) => console.error('[Firestore] subscribeRawMaterialStock:', err.code),
  );
}

export async function saveRawMaterialStock(code, data) {
  // code = codigoMicrodata or descricao — used as doc ID
  const safeId = String(code).replace(/[^a-zA-Z0-9_-]/g, '_');
  await setDoc(doc(db, 'raw_material_stock', safeId), {
    ...data,
    code,
    updatedAt: Timestamp.now(),
  }, { merge: true });
}

// ─── Finished Goods Stock ─────────────────────────────────────────────────────
export function subscribeFinishedGoodsStock(callback) {
  return onSnapshot(
    collection(db, 'finished_goods_stock'),
    (snap) => {
      const map = {};
      snap.docs.forEach((d) => { map[d.id] = { ...d.data() }; });
      callback(map);
    },
    (err) => console.error('[Firestore] subscribeFinishedGoodsStock:', err.code),
  );
}

export async function saveFinishedGoodStock(productId, data) {
  await setDoc(doc(db, 'finished_goods_stock', productId), {
    ...data,
    productId,
    updatedAt: Timestamp.now(),
  }, { merge: true });
}

// ─── Production Records (write) ──────────────────────────────────────────────
export async function saveProductionRecord(record) {
  // ID único por fábrica + produto + data → re-sync agrega corretamente (sem duplicar por máquina)
  const docId = `${record.factory}__${record.product}__${record.date}`;
  await setDoc(doc(db, 'production_records', docId), {
    factory:     record.factory,
    machine:     record.machine,
    machineName: record.machineName || record.machine,
    product:     record.product,
    productName: record.productName || record.product,
    date:        Timestamp.fromDate(new Date(record.date + 'T12:00:00')),
    actual:      Math.round((Number(record.actual) || 0) * 100) / 100,
    planned:     Math.round((Number(record.planned) || 0) * 100) / 100,
    source:      'csv',
    updatedAt:   Timestamp.now(),
  }, { merge: true });
}

// ─── Forecast ─────────────────────────────────────────────────────────────────
export function subscribeForecast(callback) {
  return onSnapshot(
    collection(db, 'forecast'),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error('[Firestore] subscribeForecast:', err.code),
  );
}

export async function saveForecastEntry(code, data) {
  const safeId = String(code).replace(/[^a-zA-Z0-9_-]/g, '_');
  await setDoc(doc(db, 'forecast', safeId), {
    ...data,
    code,
    updatedAt: Timestamp.now(),
  }, { merge: true });
}

export async function deleteForecastEntry(id) {
  await deleteDoc(doc(db, 'forecast', id));
}

// ─── Historical Adherence ─────────────────────────────────────────────────────
// Busca totais de planejado e realizado de um mês específico (one-shot, não subscribe)
export async function fetchMonthSummary(factory, yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  const start = Timestamp.fromDate(new Date(year, month - 1, 1));
  const end   = Timestamp.fromDate(new Date(year, month,     0, 23, 59, 59));

  const factories = factory === 'all' ? ['matriz', 'filial'] : [factory];
  let totalPlanned = 0;
  let totalActual  = 0;

  // Par (produto__fábrica) com planejamento — evita dupla-contagem cross-factory
  const plannedPairs = new Set();

  const snaps = await Promise.all(factories.map(async (f) => {
    const qP = query(collection(db, 'planning_entries'),   where('factory', '==', f), where('date', '>=', start), where('date', '<=', end));
    const qR = query(collection(db, 'production_records'), where('factory', '==', f), where('date', '>=', start), where('date', '<=', end));
    const [snapP, snapR] = await Promise.all([getDocs(qP), getDocs(qR)]);
    return { f, snapP, snapR };
  }));

  // 1ª passagem: soma planejado e coleta pares (produto, fábrica) programados
  snaps.forEach(({ f, snapP }) => {
    snapP.forEach((d) => {
      const e = d.data();
      if (e.cellType === 'producao' || !e.cellType) {
        totalPlanned += e.planned || 0;
        if (e.product) plannedPairs.add(`${e.product}__${f}`);
      }
    });
  });

  // 2ª passagem: conta realizado apenas para produtos planejados na mesma fábrica
  snaps.forEach(({ f, snapR }) => {
    snapR.forEach((d) => {
      const r = d.data();
      if (plannedPairs.has(`${r.product}__${f}`)) totalActual += r.actual || 0;
    });
  });

  const adherence = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : null;
  return { yearMonth, totalPlanned: Math.round(totalPlanned), totalActual: Math.round(totalActual), adherence };
}

// ─── Agent Logs ───────────────────────────────────────────────────────────────
export async function saveAgentLog(log) {
  await setDoc(doc(collection(db, 'agent_logs')), { ...log, timestamp: Timestamp.now() });
}

// ─── CSV Cross-device Sync (Firestore chunks) ────────────────────────────────
// Rows are split into 500-row chunks stored as Firestore sub-documents.
// Firestore is used instead of Storage to guarantee cross-device delivery
// without any CORS, bucket, or Storage-rules configuration.

const CSV_CHUNK_SIZE = 500;
const CSV_META_REF   = () => doc(db, 'appSettings', 'csvSync');
const CSV_CHUNK_REF  = (i) => doc(db, 'appSettings', 'csvSync', 'chunks', String(i));

let _lastUploadMs = 0;

/**
 * Splits rows into 500-row Firestore documents then writes the metadata doc.
 * Writing metadata last ensures subscribers only fire once all chunks exist.
 */
export async function uploadCsvSync(rows, fileName) {
  _lastUploadMs = Date.now();

  const chunks = [];
  for (let i = 0; i < rows.length; i += CSV_CHUNK_SIZE) {
    chunks.push(rows.slice(i, i + CSV_CHUNK_SIZE));
  }

  // Firestore batch (max 500 ops — we have at most ~100 chunks for any real CSV)
  const batch = writeBatch(db);
  chunks.forEach((chunk, i) => batch.set(CSV_CHUNK_REF(i), { rows: chunk }));
  await batch.commit();

  await setDoc(CSV_META_REF(), {
    fileName:   fileName || 'producao.csv',
    syncedAt:   Timestamp.now(),
    rowCount:   rows.length,
    chunkCount: chunks.length,
  }, { merge: true });
}

/**
 * Reads all chunk documents and assembles the full row array.
 */
export async function downloadCsvRows() {
  const metaSnap = await getDoc(CSV_META_REF());
  if (!metaSnap.exists()) throw new Error('Nenhum CSV sincronizado');
  const { chunkCount } = metaSnap.data();
  if (!chunkCount) return [];

  const snaps = await Promise.all(
    Array.from({ length: chunkCount }, (_, i) => getDoc(CSV_CHUNK_REF(i))),
  );
  return snaps.flatMap((s) => s.data()?.rows || []);
}

/**
 * Subscribes to CSV sync metadata. Callback is suppressed on the uploading
 * device (30 s window) to avoid an unnecessary re-download of data just sent.
 */
export function subscribeCsvSync(callback) {
  return onSnapshot(
    CSV_META_REF(),
    (snap) => {
      if (!snap.exists()) return;
      const data    = snap.data();
      const syncedAt = data.syncedAt?.toMillis?.() || 0;
      if (Math.abs(syncedAt - _lastUploadMs) < 30_000) return;
      callback({ ...data, syncedAt });
    },
    (err) => console.warn('[Firestore] subscribeCsvSync:', err.code),
  );
}

export default app;
