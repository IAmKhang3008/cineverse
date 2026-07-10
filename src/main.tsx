import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept and suppress benign Vite WebSocket / HMR disconnect warnings in the iframe sandbox
if (typeof window !== 'undefined') {
  const isBenignViteError = (err: any): boolean => {
    if (!err) return false;
    const str = String(err.message || err.reason || err).toLowerCase();
    return (
      str.includes('websocket') ||
      str.includes('hmr') ||
      str.includes('vite') ||
      str.includes('web socket')
    );
  };

  window.addEventListener('error', (event) => {
    if (isBenignViteError(event.error) || isBenignViteError(event.message)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    if (isBenignViteError(event.reason)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
