import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { History as HistoryIcon, MessageSquareWarning, Trash2, Activity, Gauge, Timer, Layers, Volume2 } from 'lucide-react';
import { api, errMsg } from '../api/client.js';
import { Badge, ConfidenceBar, EmptyState, Field, Modal, PageHeader, PageLoader, Pagination, StatCard, fmtDate, pct } from '../components/ui.jsx';

export default function History() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState(null);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [signs, setSigns] = useState([]);
  const [report, setReport] = useState(null);
  const [form, setForm] = useState({ expectedSignId: '', comment: '' });
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async (p = page) => {
    try {
      const [l, s] = await Promise.all([api.get('/translations/me', { params: { page: p, limit: 15 } }), api.get('/translations/me/stats')]);
      setLogs(l.data.items); setMeta(l.data.meta); setStats(s.data.stats);
    } catch (err) { toast.error(errMsg(err)); }
  }, [page]);

  useEffect(() => { load(page); }, [page, load]);
  useEffect(() => { api.get('/signs', { params: { limit: 500 } }).then(({ data }) => setSigns(data.items)).catch(() => {}); }, []);

  const remove = async (id) => {
    try { await api.delete(`/translations/${id}`); toast.success('Deleted'); load(); } catch (err) { toast.error(errMsg(err)); }
  };
  const clearAll = async () => {
    try { const { data } = await api.delete('/translations/me'); toast.success(`${data.deleted} records cleared`); setConfirmClear(false); setPage(1); load(1); } catch (err) { toast.error(errMsg(err)); }
  };
  const submitReport = async () => {
    try {
      await api.post('/feedback', { logId: report._id, ...(form.expectedSignId ? { expectedSignId: form.expectedSignId } : {}), comment: form.comment });
      toast.success('Thanks — this helps improve the model');
      setReport(null); setForm({ expectedSignId: '', comment: '' }); load();
    } catch (err) { toast.error(errMsg(err)); }
  };

  if (!logs || !stats) return <PageLoader />;

  return (
    <div className="container-x py-10">
      <PageHeader eyebrow="Your activity" title="Translation history"
        subtitle="Only recognised text and confidence are stored — never video. Report wrong results to help retrain the model."
        actions={logs.length > 0 && <button type="button" className="btn-outline btn-sm" onClick={() => setConfirmClear(true)}><Trash2 className="h-4 w-4" /> Clear history</button>} />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Activity} label="Signs translated" value={stats.total} />
        <StatCard icon={Gauge} label="Avg confidence" value={pct(stats.avgConfidence)} tone="moss" />
        <StatCard icon={Timer} label="Avg inference" value={`${stats.avgLatency.toFixed(1)} ms`} tone="amber" />
        <StatCard icon={Layers} label="Sessions" value={stats.sessions} tone="sand" hint={stats.topSigns[0] ? `Most used: ${stats.topSigns[0].word}` : undefined} />
      </div>

      {logs.length === 0 ? (
        <EmptyState icon={HistoryIcon} title="No translations yet" action={<Link to="/translate" className="btn-primary">Open the translator</Link>}>
          Signs you translate while signed in will appear here.
        </EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>Sign</th><th className="w-56">Confidence</th><th>Inference</th><th>When</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id}>
                  <td>
                    <span className="font-semibold text-ink">{l.recognizedText}</span>
                    {l.spoken && <Volume2 className="ml-2 inline h-3.5 w-3.5 text-ink-mute" aria-label="Spoken" />}
                  </td>
                  <td><div className="flex items-center gap-3"><ConfidenceBar value={l.confidence} /><span className="w-12 font-mono text-xs">{pct(l.confidence)}</span></div></td>
                  <td className="font-mono text-xs text-ink-mute">{l.latencyMs} ms</td>
                  <td className="whitespace-nowrap text-ink-soft">{fmtDate(l.createdAt)}</td>
                  <td className="whitespace-nowrap text-right">
                    {l.feedbackStatus
                      ? <Badge tone="amber" className="capitalize">Reported · {l.feedbackStatus}</Badge>
                      : <button type="button" className="btn-ghost btn-sm" onClick={() => setReport(l)}><MessageSquareWarning className="h-4 w-4" /> Wrong?</button>}
                    <button type="button" className="btn-ghost btn-sm text-rust-600" onClick={() => remove(l._id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination meta={meta} onPage={setPage} />

      <Modal open={Boolean(report)} onClose={() => setReport(null)} title="Report a wrong translation"
        footer={<><button type="button" className="btn-ghost" onClick={() => setReport(null)}>Cancel</button><button type="button" className="btn-primary" onClick={submitReport}>Send report</button></>}>
        {report && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">The model recognised <strong className="text-ink">“{report.recognizedText}”</strong> at {pct(report.confidence)} confidence.</p>
            <Field label="What did you actually sign?">
              <select className="input" value={form.expectedSignId} onChange={(e) => setForm({ ...form, expectedSignId: e.target.value })}>
                <option value="">Not sure / not in the list</option>
                {signs.map((s) => <option key={s._id} value={s._id}>{s.word}</option>)}
              </select>
            </Field>
            <Field label="Comment (optional)"><textarea className="input" rows={3} maxLength={500} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      <Modal open={confirmClear} onClose={() => setConfirmClear(false)} title="Clear all history?"
        footer={<><button type="button" className="btn-ghost" onClick={() => setConfirmClear(false)}>Cancel</button><button type="button" className="btn-danger" onClick={clearAll}>Delete everything</button></>}>
        <p className="text-sm text-ink-soft">This permanently deletes all {meta?.total} translation records and any reports attached to them.</p>
      </Modal>
    </div>
  );
}
