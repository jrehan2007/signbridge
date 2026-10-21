import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { LayoutDashboard, FlaskConical, Boxes, BookOpen, Users, MessageSquareWarning } from 'lucide-react';
import { PageHeader, cx } from '../../components/ui.jsx';
import Overview from './Overview.jsx';
import ModelStudio from './ModelStudio.jsx';
import Models from './Models.jsx';
import Signs from './Signs.jsx';
import UsersAdmin from './Users.jsx';
import FeedbackAdmin from './Feedback.jsx';

const TABS = [
  { to: 'overview', label: 'Overview', icon: LayoutDashboard },
  { to: 'studio', label: 'Model Studio', icon: FlaskConical },
  { to: 'models', label: 'Models', icon: Boxes },
  { to: 'signs', label: 'Signs', icon: BookOpen },
  { to: 'users', label: 'Users', icon: Users },
  { to: 'feedback', label: 'Feedback', icon: MessageSquareWarning },
];

export default function Admin() {
  return (
    <div className="container-x py-10">
      <PageHeader eyebrow="Administration" title="Admin console" subtitle="Monitor usage, train and publish recognition models, and curate the ISL dictionary." />
      <nav className="segmented mb-8 sm:w-fit" aria-label="Admin sections">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => cx('segmented-item', isActive && 'segmented-item-active')}>
            <Icon className="h-4 w-4" /> {label}
          </NavLink>
        ))}
      </nav>
      <Routes>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="studio" element={<ModelStudio />} />
        <Route path="models" element={<Models />} />
        <Route path="signs" element={<Signs />} />
        <Route path="users" element={<UsersAdmin />} />
        <Route path="feedback" element={<FeedbackAdmin />} />
        <Route path="*" element={<Navigate to="overview" replace />} />
      </Routes>
    </div>
  );
}
