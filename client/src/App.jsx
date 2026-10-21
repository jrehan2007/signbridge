import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { PageLoader } from './components/ui.jsx';
import Home from './pages/Home.jsx';
import { Login, Register } from './pages/Auth.jsx';
import NotFound from './pages/NotFound.jsx';

// Camera / ML / chart pages are code-split so the landing page stays light
const Translate = lazy(() => import('./pages/Translate.jsx'));
const Dictionary = lazy(() => import('./pages/Dictionary.jsx'));
const Learn = lazy(() => import('./pages/Learn.jsx'));
const History = lazy(() => import('./pages/History.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Admin = lazy(() => import('./pages/admin/Admin.jsx'));

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="translate" element={<Translate />} />
          <Route path="dictionary" element={<Dictionary />} />
          <Route element={<ProtectedRoute />}>
            <Route path="learn" element={<Learn />} />
            <Route path="learn/:signId" element={<Learn />} />
            <Route path="history" element={<History />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route element={<ProtectedRoute role="admin" />}>
            <Route path="admin/*" element={<Admin />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
