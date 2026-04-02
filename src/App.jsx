import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore, useAdminStore } from './hooks/useStore';
import { onAuthChange, getUserRole, subscribeProducts } from './services/firebase';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Planning from './pages/Planning';
import Production from './pages/Production';
import Admin from './pages/Admin';
import Login from './pages/Login';

export default function App() {
  const { user, loading, setUser, setLoading } = useAuthStore();
  const setProducts = useAdminStore((s) => s.setProducts);

  useEffect(() => {
    // Escuta produtos pra toda a aplicação (Planning, Admin, etc)
    const unsubProducts = subscribeProducts((data) => {
      setProducts(data);
    });
    setLoading(true);
    const unsub = onAuthChange(async (fu) => {
      if (fu) {
        // Busca role do Firestore (não do token)
        const role = await getUserRole(fu.uid);
        setUser({
          uid: fu.uid,
          email: fu.email,
          name: fu.displayName || fu.email.split('@')[0],
          role: role || 'planner',
        });
      } else {
        setUser(null);
      }
    });
    return () => {
      unsub();
      unsubProducts();
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
        <Route path="/admin"      element={user.role === 'admin' ? <Admin /> : <Navigate to="/" replace />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
