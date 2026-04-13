import React from 'react';

async function nukeAndReload() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (_) { /* ignore */ }
  window.location.replace(window.location.origin + '/?nocache=' + Date.now());
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0c1222', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', padding: 24,
      }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Erro ao carregar o app</h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
            {String(this.state.error?.message || this.state.error || 'Erro desconhecido')}
          </p>
          <button onClick={nukeAndReload} style={{
            padding: '10px 20px', background: '#06b6d4', color: '#0c1222',
            border: 0, borderRadius: 12, fontWeight: 700, cursor: 'pointer', fontSize: 13,
          }}>
            Limpar cache e recarregar
          </button>
          <p style={{ fontSize: 11, color: '#64748b', marginTop: 12 }}>
            Isso remove dados offline e baixa a versão mais recente.
          </p>
        </div>
      </div>
    );
  }
}
