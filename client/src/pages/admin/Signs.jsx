import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { api, errMsg } from '../../api/client.js';
import { Badge, Field, Modal, PageLoader, Spinner } from '../../components/ui.jsx';

const EMPTY = { word: '', category: 'word', handType: 'one', gestureType: 'static', description: '', howTo: '', mediaUrl: '' };

export default function Signs() {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | sign
  const [form, setForm] = useState(EMPTY);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get('/signs', { params: { limit: 500 } }).then(({ data }) => setItems(data.items)).catch((e) => toast.error(errMsg(e))), []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => (items || []).filter((s) => s.word.toLowerCase().includes(q.toLowerCase())), [items, q]);

  const openEdit = (s) => {
    setEditing(s);
    setForm(s === 'new' ? EMPTY : { ...EMPTY, ...s, howTo: (s.howTo || []).join('\n') });
  };

  const save = async () => {
    const payload = {
      word: form.word.trim(), category: form.category, handType: form.handType, gestureType: form.gestureType,
      description: form.description, mediaUrl: form.mediaUrl.trim(),
      howTo: form.howTo.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    setBusy(true);
    try {
      if (editing === 'new') await api.post('/signs', payload); else await api.patch(`/signs/${editing._id}`, payload);
      toast.success('Sign saved'); setEditing(null); load();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  const remove = async () => {
    try { await api.delete(`/signs/${confirm._id}`); toast.success('Sign deleted'); setConfirm(null); load(); } catch (e) { toast.error(errMsg(e)); }
  };

  if (!items) return <PageLoader />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
          <input className="input pl-9" placeholder="Filter signs…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter signs" />
        </div>
        <button type="button" className="btn-primary btn-sm" onClick={() => openEdit('new')}><Plus className="h-4 w-4" /> New sign</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="table-x">
          <thead><tr><th>#</th><th>Word</th><th>Category</th><th>Hands</th><th>Gesture</th><th>Description</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s._id}>
                <td className="font-mono text-xs text-ink-mute">{s.labelIndex}</td>
                <td className="font-semibold">{s.word}</td>
                <td><Badge tone="sand" className="capitalize">{s.category}</Badge></td>
                <td>{s.handType === 'two' ? 'Two' : 'One'}</td>
                <td className="capitalize">{s.gestureType}</td>
                <td className="max-w-xs truncate text-ink-soft" title={s.description}>{s.description}</td>
                <td className="whitespace-nowrap text-right">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => openEdit(s)} aria-label={`Edit ${s.word}`}><Pencil className="h-4 w-4" /></button>
                  <button type="button" className="btn-ghost btn-sm text-rust-600" onClick={() => setConfirm(s)} aria-label={`Delete ${s.word}`}><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing === 'new' ? 'New sign' : `Edit “${editing?.word}”`}
        footer={<><button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button type="button" className="btn-primary" disabled={busy || !form.word.trim()} onClick={save}>{busy && <Spinner className="h-4 w-4 text-white" />} Save</button></>}>
        <div className="space-y-4">
          <Field label="Word / label" hint="Must match the class label used when training the model"><input className="input" value={form.word} onChange={set('word')} maxLength={60} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Category"><select className="input" value={form.category} onChange={set('category')}><option value="alphabet">Alphabet</option><option value="digit">Digit</option><option value="word">Word</option><option value="phrase">Phrase</option></select></Field>
            <Field label="Hands"><select className="input" value={form.handType} onChange={set('handType')}><option value="one">One</option><option value="two">Two</option></select></Field>
            <Field label="Gesture"><select className="input" value={form.gestureType} onChange={set('gestureType')}><option value="static">Static</option><option value="dynamic">Dynamic</option></select></Field>
          </div>
          <Field label="Description"><textarea className="input" rows={3} maxLength={600} value={form.description} onChange={set('description')} /></Field>
          <Field label="How-to steps" hint="One step per line"><textarea className="input" rows={3} value={form.howTo} onChange={set('howTo')} /></Field>
          <Field label="Demo video URL (optional)"><input className="input" value={form.mediaUrl} onChange={set('mediaUrl')} placeholder="https://…/hello.mp4" /></Field>
        </div>
      </Modal>

      <Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} title="Delete sign?"
        footer={<><button type="button" className="btn-ghost" onClick={() => setConfirm(null)}>Cancel</button><button type="button" className="btn-danger" onClick={remove}>Delete</button></>}>
        <p className="text-sm text-ink-soft">“{confirm?.word}” will be removed from the dictionary. Existing translation logs are kept; learner progress for this sign is removed.</p>
      </Modal>
    </div>
  );
}
