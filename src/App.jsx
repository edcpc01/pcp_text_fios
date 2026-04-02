import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './hooks/useStore';
import { onAuthChange } from './services/firebase';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Planning from './pages/Planning';
import Production from './pages/Production';
import Login from './pages/Login';

export default function App() {
  const { user, loading, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    setLoading(true);
    const unsub = onAuthChange((firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
        });
      } else {
        setUser(null);
      }
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-dark">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-brand-doptex border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/planning" element={<Planning />} />
        <Route path="/production" element={<Production />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
