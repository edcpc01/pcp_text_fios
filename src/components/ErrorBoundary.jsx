import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  handleRecover = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } finally {
      window.location.reload();
    }
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-brand-bg px-6">
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-lg font-bold text-white mb-2">Erro ao carregar o app</h1>
            <p className="text-sm text-brand-muted mb-6 break-words">
              {this.state.error?.message || 'Erro desconhecido'}
            </p>
            <button
              onClick={this.handleRecover}
              className="px-6 py-3 rounded-xl bg-brand-cyan text-brand-bg font-bold text-sm hover:opacity-90 transition-opacity"
            >
              Limpar cache e recarregar
            </button>
            <p className="text-xs text-brand-muted mt-3">
              Isso remove dados offline e baixa a versão mais recente.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
