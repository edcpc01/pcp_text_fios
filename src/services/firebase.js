import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, doc, getDoc, setDoc,
  deleteDoc, query, where, orderBy, onSnapshot, Timestamp,
  enableIndexedDbPersistence,
} from 'firebase/firestore';
import {
  getAuth, signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged,
} from 'firebase/auth';
import { makeEntryId } from '../hooks/useStore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') console.warn('Firestore persistence: multiple tabs');
  else if (err.code === 'unimplemented')  console.warn('Firestore persistence: unsupported');
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const signIn       = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export const signOut      = () => firebaseSignOut(auth);
export const onAuthChange = (cb) => onAuthStateChanged(auth, cb);

export async function getUserRole(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? (snap.data().role || 'planner') : 'planner';
  } catch { return 'planner'; }
}

// ─── Planning ─────────────────────────────────────────────────────────────────
export function subscribePlanningEntries(factory, yearMonth, callback) {
  const [year, month] = yearMonth.split('-').map(Number);
  const start = Timestamp.fromDate(new Date(year, month - 1, 1));
  const end   = Timestamp.fromDate(new Date(year, month, 0, 23, 59, 59));
  const q = query(
    collection(db, 'planning_entries'),
    where('factory', '==', factory),
    where('date', '>=', start),
    where('date', '<=', end),
    orderBy('date', 'asc'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({
      ...d.data(),
      id:   d.id,
      date: d.data().date?.toDate?.()?.toISOString?.()?.split('T')[0],
    })));
  });
}

// Save uses stable ID = factory__machine__date
// setDoc with merge:true → always upsert, never creates duplicate
export async function savePlanningEntry(entry) {
  const stableId = makeEntryId(entry.factory, entry.machine, entry.date);
  const data = {
    factory:     entry.factory,
    machine:     entry.machine,
    machineName: entry.machineName || entry.machine,
    product:     entry.product     || '',
    productName: entry.productName || '',
    date:        Timestamp.fromDate(new Date(entry.date + 'T12:00:00')),
    planned:     entry.planned     || 0,
    quality:     entry.quality     || 'A',
    side:        entry.side        || 'Lado A',
    cellType:    entry.cellType    || 'producao',
    updatedAt:   Timestamp.now(),
  };
  await setDoc(doc(db, 'planning_entries', stableId), data, { merge: true });
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
  const q = query(
    collection(db, 'production_records'),
    where('factory', '==', factory),
    where('date', '>=', start),
    where('date', '<=', end),
    orderBy('date', 'asc'),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({
      ...d.data(),
      id:   d.id,
      date: d.data().date?.toDate?.()?.toISOString?.()?.split('T')[0],
    })));
  });
}

export async function saveAgentLog(log) {
  await setDoc(doc(collection(db, 'agent_logs')), { ...log, timestamp: Timestamp.now() });
}

export default app;
