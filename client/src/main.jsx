import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            style: { borderRadius: '10px', background: '#FFFFFF', color: '#0F172A', fontSize: '14px', border: '1px solid #E2E8F0', boxShadow: '0 10px 30px -12px rgba(15,23,42,.25)', padding: '10px 14px' },
            success: { iconTheme: { primary: '#047857', secondary: '#FFFFFF' } },
            error: { iconTheme: { primary: '#B91C1C', secondary: '#FFFFFF' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
