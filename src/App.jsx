import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore, useAdminStore, useCsvStore } from './hooks/useStore';
import { onAuthChange, getUserRole, subscribeProducts, subscribeMachines, subscribeCsvSync } from './services/firebase';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Planning from './pages/Planning';
import Production from './pages/Production';
import Admin from './pages/Admin';
import Materiais from './pages/Materiais';
import Forecast from './pages/Forecast';
import Qualidade from './pages/Qualidade';
import OEEPage from './pages/OEE';
import Login from './pages/Login';

export default function App() {
  const { user, loading, setUser, setLoading } = useAuthStore();
  const setProducts = useAdminStore((s) => s.setProducts);
  const setMachines = useAdminStore((s) => s.setMachines);

  useEffect(() => {
    // Escuta produtos pra toda a aplicação (Planning, Admin, etc)
    const unsubProducts = subscribeProducts((data) => {
      setProducts(data);
    });
    const unsubMachines = subscribeMachines((data) => {
      setMachines(data);
    });

    // ── CSV cross-device sync ──────────────────────────────────────────────
    // When another device uploads a new CSV, download and populate the shared store.
    let prevSyncedAt = 0;
    const unsubCsv = subscribeCsvSync(async (meta) => {
      if (!meta.downloadUrl || meta.syncedAt <= prevSyncedAt) return;
      prevSyncedAt = meta.syncedAt;
      try {
        const res = await fetch(meta.downloadUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = await res.json();
        const { setRows, setFileName, setLastSync } = useCsvStore.getState();
        setRows(rows);
        if (meta.fileName) setFileName(meta.fileName);
        setLastSync(new Date(meta.syncedAt));
      } catch (err) {
        console.warn('[csvSync] Failed to download rows:', err.message);
      }
    });

    setLoading(true);
    
    // Timeout de segurança: se Firebase falhar em 10s, cancela loading
    const timeout = setTimeout(() => {
      if (useAuthStore.getState().loading) {
        console.warn('[App] Auth timeout reached, forcing loading false');
        setLoading(false);
      }
    }, 10000);

    const unsub = onAuthChange(async (fu) => {
      try {
        if (fu) {
          const role = await getUserRole(fu.uid, fu);
          setUser({
            uid: fu.uid,
            email: fu.email,
            name: fu.displayName || fu.email.split('@')[0],
            role: role || 'supervisor',
          });
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('[App] Auth update failed:', err);
        setUser(null); // Também limpa loading
      } finally {
        clearTimeout(timeout);
      }
    });

    return () => {
      unsub();
      unsubProducts();
      unsubMachines();
      unsubCsv();
      clearTimeout(timeout);
    };
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-brand-cyan border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-brand-muted text-sm">Carregando...</p>
      </div>
    </div>
  );

  if (!user) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/"           element={<Dashboard />} />
        <Route path="/planning"   element={<Planning />} />
        <Route path="/production" element={<Production />} />
        <Route path="/materiais"  element={<Materiais />} />
        <Route path="/forecast"    element={<Forecast />} />
        <Route path="/qualidade"   element={<Qualidade />} />
        <Route path="/oee"         element={<OEEPage />} />
        <Route path="/admin"      element={user.role === 'admin' ? <Admin /> : <Navigate to="/" replace />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
