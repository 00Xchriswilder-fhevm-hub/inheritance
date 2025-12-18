import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { initializePorto } from './porto/config';

// Initialize Porto SDK on app startup
// This injects Porto as a wallet provider via EIP-6963,
// making it available for wallet connection libraries like RainbowKit
initializePorto();

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