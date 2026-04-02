import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, doc, getDocs, setDoc, updateDoc,
  deleteDoc, query, where, orderBy, onSnapshot, writeBatch, Timestamp,
  enableIndexedDbPersistence,
} from 'firebase/firestore';
import {
  getAuth, signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') console.warn('Firestore persistence: multiple tabs open');
  else if (err.code === 'unimplemented') console.warn('Firestore persistence: not supported');
});

export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signOut = () => firebaseSignOut(auth);
export const onAuthChange = (callback) => onAuthStateChanged(auth, callback);

const COLLECTIONS = {
  planning: 'planning_entries',
  production: 'production_records',
  agents: 'agent_logs',
};

// ─── Planning ────────────────────────────────────────────────────────────────

export function subscribePlanningEntries(factory, yearMonth, callback) {
  const [year, month] = yearMonth.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  const q = query(
    collection(db, COLLECTIONS.planning),
    where('factory', '==', factory),
    where('date', '>=', Timestamp.fromDate(startDate)),
    where('date', '<=', Timestamp.fromDate(endDate)),
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
  const docRef = entry.id && !entry.id.startsWith('local-')
    ? doc(db, COLLECTIONS.planning, entry.id)
    : doc(collection(db, COLLECTIONS.planning));
  const data = { ...entry, date: Timestamp.fromDate(new Date(entry.date + 'T12:00:00')), updatedAt: Timestamp.now() };
  delete data.id;
  if (entry.id && !entry.id.startsWith('local-')) {
    await updateDoc(docRef, data);
  } else {
    data.createdAt = Timestamp.now();
    await setDoc(docRef, data);
  }
  return docRef.id;
}

export async function deletePlanningEntry(id) {
  await deleteDoc(doc(db, COLLECTIONS.planning, id));
}

// ─── Production ──────────────────────────────────────────────────────────────

export function subscribeProductionRecords(factory, yearMonth, callback) {
  const [year, month] = yearMonth.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  const q = query(
    collection(db, COLLECTIONS.production),
    where('factory', '==', factory),
    where('date', '>=', Timestamp.fromDate(startDate)),
    where('date', '<=', Timestamp.fromDate(endDate)),
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
    ? doc(db, COLLECTIONS.production, record.id)
    : doc(collection(db, COLLECTIONS.production));
  const data = { ...record, date: Timestamp.fromDate(new Date(record.date + 'T12:00:00')), importedAt: Timestamp.now(), source: record.source || 'manual' };
  delete data.id;
  await setDoc(docRef, data, { merge: true });
  return docRef.id;
}

export async function batchSaveProductionRecords(records) {
  const batch = writeBatch(db);
  for (const record of records) {
    const docRef = doc(collection(db, COLLECTIONS.production));
    batch.set(docRef, { ...record, date: Timestamp.fromDate(new Date(record.date + 'T12:00:00')), importedAt: Timestamp.now(), source: 'microdata_agent' });
  }
  await batch.commit();
}

export async function saveAgentLog(log) {
  const docRef = doc(collection(db, COLLECTIONS.agents));
  await setDoc(docRef, { ...log, timestamp: Timestamp.now() });
}

export default app;
