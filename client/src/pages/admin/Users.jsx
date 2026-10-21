import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Search } from 'lucide-react';
import { api, errMsg } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Badge, PageLoader, Pagination, fmtDate } from '../../components/ui.jsx';

export default function UsersAdmin() {
  const { user: me } = useAuth();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');

  const load = useCallback(() => {
    api.get('/admin/users', { params: { page, limit: 20, ...(q ? { q } : {}), ...(role ? { role } : {}) } })
      .then(({ data: d }) => setData(d)).catch((e) => toast.error(errMsg(e)));
  }, [page, q, role]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const update = async (u, patch) => {
    try { await api.patch(`/admin/users/${u._id}`, patch); toast.success('User updated'); load(); } catch (e) { toast.error(errMsg(e)); }
  };

  if (!data) return <PageLoader />;
  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
          <input className="input pl-9" placeholder="Search name or email…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search users" />
        </div>
        <select className="input sm:w-44" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Filter by role">
          <option value="">All roles</option><option value="user">User</option><option value="learner">Learner</option><option value="admin">Admin</option>
        </select>
      </div>
      <div className="card overflow-x-auto">
        <table className="table-x">
          <thead><tr><th>User</th><th>Role</th><th>Voice</th><th>Joined</th><th>Status</th></tr></thead>
          <tbody>
            {data.items.map((u) => {
              const self = u._id === me._id;
              return (
                <tr key={u._id}>
                  <td><p className="font-semibold">{u.name}{self && <span className="ml-2 text-xs text-ink-mute">(you)</span>}</p><p className="text-xs text-ink-mute">{u.email}</p></td>
                  <td>
                    <select className="input w-32 py-1.5" value={u.role} disabled={self} onChange={(e) => update(u, { role: e.target.value })} aria-label={`Role for ${u.name}`}>
                      <option value="user">User</option><option value="learner">Learner</option><option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="uppercase">{u.preferredLang}</td>
                  <td className="whitespace-nowrap text-ink-soft">{fmtDate(u.createdAt)}</td>
                  <td>
                    <button type="button" disabled={self} onClick={() => update(u, { isActive: !u.isActive })} className="disabled:cursor-not-allowed">
                      <Badge tone={u.isActive ? 'moss' : 'rust'}>{u.isActive ? 'Active' : 'Disabled'}</Badge>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination meta={data.meta} onPage={setPage} />
    </div>
  );
}
