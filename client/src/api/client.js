import axios from 'axios';

const TOKEN_KEY = 'signbridge.token';

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};

// Same-origin by default (Vite proxy in dev, Express static in prod); override with VITE_API_URL
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const api = axios.create({ baseURL: `${API_BASE}/api`, timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && tokenStore.get()) onUnauthorized();
    return Promise.reject(err);
  }
);

/** Human-readable message from an axios error */
export const errMsg = (err, fallback = 'Something went wrong') => {
  const d = err?.response?.data;
  if (d?.details?.length) return d.details.map((x) => x.message).join(' · ');
  if (d?.message) return d.message;
  if (err?.code === 'ERR_NETWORK' || err?.response?.status >= 500) return 'The server is unavailable right now. Please try again in a moment.';
  if (err?.code === 'ECONNABORTED') return 'The request timed out. Please check your connection and try again.';
  return err?.message || fallback;
};

/** Absolute URL for files served by the API (model.json, uploads) */
export const assetUrl = (path) => (path?.startsWith('http') ? path : `${API_BASE}${path}`);
