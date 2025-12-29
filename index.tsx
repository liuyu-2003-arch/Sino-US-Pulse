import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// ✅ Polyfill for AWS SDK (Required for browser usage)
import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  window.global = window;
  window.Buffer = Buffer;
  // Simple process polyfill
  if (!window.process) {
    // @ts-ignore
    window.process = { env: {} };
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);