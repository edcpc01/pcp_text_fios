import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, doc, getDoc, setDoc, updateDoc,
  deleteDoc, query, where, orderBy, onSnapshot, writeBatch, Timestamp,
  enableIndexedDbPersistence,
} from 'firebase/firestore';
import {
  getAuth, signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);
export const auth = getAuth(app);

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') console.warn('Firestore persistence: multiple tabs open');
  else if (err.code === 'unimplemented')  console.warn('Firestore persistence: not supported');
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const signIn      = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signOut     = () => firebaseSignOut(auth);
export const onAuthChange = (callback) => onAuthStateChanged(auth, callback);

// Busca o role do usuário no Firestore /users/{uid}
export async function getUserRole(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) return snap.data().role || 'planner';
    return 'planner';
  } catch {
    return 'planner';
  }
}

// ─── Collections ──────────────────────────────────────────────────────────────
const C = {
  planning:   'planning_entries',
  production: 'production_records',
  agents:     'agent_logs',
};

// ─── Planning ─────────────────────────────────────────────────────────────────
export function subscribePlanningEntries(factory, yearMonth, callback) {
  const [year, month] = yearMonth.split('-').map(Number);
  const start = Timestamp.fromDate(new Date(year, month - 1, 1));
  const end   = Timestamp.fromDate(new Date(year, month, 0, 23, 59, 59));
  const q = query(
    collection(db, C.planning),
    where('factory', '==', factory),
    where('date', '>=', start),
    where('date', '<=', end),
    orderBy('date', 'asc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({
      id: d.id, ...d.data(),
      date: d.data().date?.toDate?.()?.toISOString?.()?.split('T')[0],
    })));
  });
}

export async function savePlanningEntry(entry) {
  // Use deterministic ID: factory-machine-date-side to avoid duplicates
  const stableId = entry.id && !entry.id.startsWith('local-')
    ? entry.id
    : `${entry.factory}-${entry.machine}-${entry.date}-${(entry.side || 'A').replace(/\s/g, '')}`;

  const docRef = doc(db, C.planning, stableId);
  const data   = {
    ...entry,
    date:      Timestamp.fromDate(new Date(entry.date + 'T12:00:00')),
    updatedAt: Timestamp.now(),
  };
  delete data.id;
  data.createdAt = data.createdAt || Timestamp.now();
  await setDoc(docRef, data, { merge: true });
  return stableId;
}

export async function deletePlanningEntry(id) {
  await deleteDoc(doc(db, C.planning, id));
}

// ─── Production ───────────────────────────────────────────────────────────────
export function subscribeProductionRecords(factory, yearMonth, callback) {
  const [year, month] = yearMonth.split('-').map(Number);
  const start = Timestamp.fromDate(new Date(year, month - 1, 1));
  const end   = Timestamp.fromDate(new Date(year, month, 0, 23, 59, 59));
  const q = query(
    collection(db, C.production),
    where('factory', '==', factory),
    where('date', '>=', start),
    where('date', '<=', end),
    orderBy('date', 'asc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({
      id: d.id, ...d.data(),
      date: d.data().date?.toDate?.()?.toISOString?.()?.split('T')[0],
    })));
  });
}

export async function saveProductionRecord(record) {
  const docRef = record.id
    ? doc(db, C.production, record.id)
    : doc(collection(db, C.production));
  const data = {
    ...record,
    date:       Timestamp.fromDate(new Date(record.date + 'T12:00:00')),
    importedAt: Timestamp.now(),
    source:     record.source || 'manual',
  };
  delete data.id;
  await setDoc(docRef, data, { merge: true });
  return docRef.id;
}

export async function saveAgentLog(log) {
  await setDoc(doc(collection(db, C.agents)), { ...log, timestamp: Timestamp.now() });
}

export default app;
