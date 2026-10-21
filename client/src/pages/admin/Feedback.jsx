import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MessageSquareWarning, ArrowRight } from 'lucide-react';
import { api, errMsg } from '../../api/client.js';
import { Badge, EmptyState, PageLoader, Pagination, Tabs, fmtDate, pct } from '../../components/ui.jsx';

const STATUSES = ['open', 'reviewed', 'used'];
const TONE = { open: 'rust', reviewed: 'amber', used: 'moss' };

export default function FeedbackAdmin() {
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    api.get('/feedback', { params: { page, limit: 20, ...(status ? { status } : {}) } }).then(({ data: d }) => setData(d)).catch((e) => toast.error(errMsg(e)));
  }, [page, status]);
  useEffect(() => { load(); }, [load]);

  const setItemStatus = async (f, s) => {
    try { await api.patch(`/feedback/${f._id}`, { status: s }); toast.success(`Marked ${s}`); load(); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div>
      <p className="mb-4 text-sm text-ink-soft">User reports of wrong translations. Use them to decide which signs need more samples, then mark them <em>used</em> once a retrained model is published.</p>
      <Tabs className="mb-4 sm:w-fit" label="Status" value={status} onChange={(s) => { setStatus(s); setPage(1); }}
        items={['', ...STATUSES].map((s) => ({ key: s, label: s ? s[0].toUpperCase() + s.slice(1) : 'All' }))} />
      {!data ? <PageLoader /> : data.items.length === 0 ? (
        <EmptyState icon={MessageSquareWarning} title="Nothing here">No {status || ''} feedback right now.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>Predicted → expected</th><th>Confidence</th><th>Comment</th><th>From</th><th>Status</th></tr></thead>
            <tbody>
              {data.items.map((f) => (
                <tr key={f._id}>
                  <td className="whitespace-nowrap">
                    <span className="font-semibold">{f.logId?.recognizedText || '—'}</span>
                    <ArrowRight className="mx-2 inline h-4 w-4 text-ink-mute" />
                    <span className="font-semibold text-moss-600">{f.expectedSignId?.word || '?'}</span>
                  </td>
                  <td className="font-mono text-xs">{f.logId ? pct(f.logId.confidence) : '—'}</td>
                  <td className="max-w-xs text-ink-soft">{f.comment || <span className="text-ink-mute">—</span>}</td>
                  <td className="whitespace-nowrap text-xs"><p className="font-semibold">{f.userId?.name}</p><p className="text-ink-mute">{fmtDate(f.createdAt)}</p></td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Badge tone={TONE[f.status]} className="capitalize">{f.status}</Badge>
                      <select className="input w-28 py-1 text-xs" value={f.status} onChange={(e) => setItemStatus(f, e.target.value)} aria-label="Change status">
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={data?.meta} onPage={setPage} />
    </div>
  );
}
