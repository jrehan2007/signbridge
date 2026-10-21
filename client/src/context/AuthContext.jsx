import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore, setUnauthorizedHandler } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokenStore.get()) return;
    api.get('/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, [logout]);

  const handleAuth = ({ data }) => {
    tokenStore.set(data.token);
    setUser(data.user);
    return data.user;
  };

  const value = useMemo(() => ({
    user,
    loading,
    isAdmin: user?.role === 'admin',
    login: (email, password) => api.post('/auth/login', { email, password }).then(handleAuth),
    register: (payload) => api.post('/auth/register', payload).then(handleAuth),
    updateProfile: (payload) => api.patch('/auth/me', payload).then(({ data }) => { setUser(data.user); return data.user; }),
    logout,
  }), [user, loading, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
