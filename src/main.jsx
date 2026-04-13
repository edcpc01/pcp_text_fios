import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/globals.css';
// Módulo virtual gerado pelo vite-plugin-pwa.
// Com registerType: 'autoUpdate', ele registra o SW e garante que skipWaiting()
// + clients.claim() sejam chamados automaticamente quando uma nova versão instala.
import { registerSW } from 'virtual:pwa-register';

registerSW({
  // immediate: true → começa a checar por updates assim que a página carrega
  immediate: true,
  onRegisteredSW(swScriptUrl, registration) {
    if (!registration) return;
    // Verifica por atualização a cada hora
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000);
  },
  onOfflineReady() {
    // App está pronto para funcionar offline
    console.info('[PWA] App pronto para uso offline.');
  },
  onNeedRefresh() {
    // Com autoUpdate este callback raramente é chamado,
    // mas se for, o PWAPrompt.jsx cuida via controllerchange.
  },
});

window.__appMounted = true;
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
