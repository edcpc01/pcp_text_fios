import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore,
  collection, doc, getDoc, setDoc, deleteDoc,
  query, where, orderBy, onSnapshot, Timestamp,
  initializeFirestore, memoryLocalCache,
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
  const stableId = makeEntryId(entry.factory, entry.machine, entry.date);
  const data = {
    factory:     entry.factory,
    machine:     entry.machine,
    machineName: entry.machineName || entry.machine,
    product:     entry.product     || '',
    productName: entry.productName || '',
    date:        Timestamp.fromDate(new Date(entry.date + 'T12:00:00')),
    planned:     Number(entry.planned) || 0,
    cellType:    entry.cellType    || 'producao',
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
  const id = product.id || `P${String(Date.now()).slice(-5)}`;
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

// ─── Agent Logs ───────────────────────────────────────────────────────────────
export async function saveAgentLog(log) {
  await setDoc(doc(collection(db, 'agent_logs')), { ...log, timestamp: Timestamp.now() });
}

export default app;
