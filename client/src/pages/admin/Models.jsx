import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Upload, CheckCircle2, Trash2, Boxes, Power } from 'lucide-react';
import { api, errMsg } from '../../api/client.js';
import { Badge, EmptyState, Field, Modal, PageLoader, Spinner, fmtDate, pct } from '../../components/ui.jsx';

export default function Models() {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ files: [], labels: '', valAccuracy: '', notes: '', activate: true });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get('/models').then(({ data }) => setItems(data.items)).catch((e) => toast.error(errMsg(e))), []);
  useEffect(() => { load(); }, [load]);

  const activate = async (m) => {
    try { await api.patch(`/models/${m._id}/activate`); toast.success(`${m.version} is now active`); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const remove = async (m) => {
    try { await api.delete(`/models/${m._id}`); toast.success(`${m.version} deleted`); load(); } catch (e) { toast.error(errMsg(e)); }
  };

  // labels.json from training/train.py is picked up automatically
  const onFiles = async (fileList) => {
    const files = Array.from(fileList);
    const labelsFile = files.find((f) => f.name === 'labels.json');
    let labels = form.labels;
    let valAccuracy = form.valAccuracy;
    if (labelsFile) {
      try {
        const parsed = JSON.parse(await labelsFile.text());
        labels = (Array.isArray(parsed) ? parsed : parsed.classLabels || []).join(', ');
        if (parsed.valAccuracy !== undefined) valAccuracy = String(parsed.valAccuracy);
      } catch { toast.error('labels.json could not be parsed'); }
    }
    setForm({ ...form, files: files.filter((f) => f.name !== 'labels.json'), labels, valAccuracy });
  };

  const upload = async () => {
    const labels = form.labels.trim().startsWith('[') ? JSON.parse(form.labels) : form.labels.split(',').map((s) => s.trim()).filter(Boolean);
    const fd = new FormData();
    form.files.forEach((f) => fd.append('files', f));
    fd.append('classLabels', JSON.stringify(labels));
    if (form.valAccuracy) fd.append('valAccuracy', form.valAccuracy);
    fd.append('notes', form.notes);
    fd.append('source', 'python');
    fd.append('activate', String(form.activate));
    setBusy(true);
    try {
      const { data } = await api.post('/models', fd);
      toast.success(`Uploaded ${data.model.version}`);
      setOpen(false); setForm({ files: [], labels: '', valAccuracy: '', notes: '', activate: true }); load();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };

  if (!items) return <PageLoader />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-soft">Every published model is versioned. Exactly one is active and served to all browsers.</p>
        <button type="button" className="btn-primary btn-sm" onClick={() => setOpen(true)}><Upload className="h-4 w-4" /> Upload trained model</button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Boxes} title="No models yet">Train one in Model Studio, or upload the output of <code>training/train.py</code>.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>Version</th><th>Classes</th><th>Val. accuracy</th><th>Samples</th><th>Source</th><th>Released</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {items.map((m) => (
                <tr key={m._id}>
                  <td>
                    <div className="flex items-center gap-2 font-mono font-semibold">{m.version}{m.isActive && <Badge tone="moss"><CheckCircle2 className="h-3 w-3" /> Active</Badge>}</div>
                    {m.notes && <p className="mt-1 max-w-xs truncate text-xs text-ink-mute" title={m.notes}>{m.notes}</p>}
                  </td>
                  <td><span className="font-semibold">{m.numClasses}</span> <span className="block max-w-[14rem] truncate text-xs text-ink-mute" title={m.classLabels.join(', ')}>{m.classLabels.join(', ')}</span></td>
                  <td className="font-mono">{pct(m.valAccuracy, 1)}</td>
                  <td className="font-mono">{m.trainedSamples || '—'}</td>
                  <td><Badge tone={m.source === 'python' ? 'amber' : 'teal'} className="capitalize">{m.source}</Badge></td>
                  <td className="whitespace-nowrap text-ink-soft">{fmtDate(m.releasedAt)}<span className="block text-xs text-ink-mute">{m.createdBy?.name}</span></td>
                  <td className="whitespace-nowrap text-right">
                    {!m.isActive && <button type="button" className="btn-outline btn-sm" onClick={() => activate(m)}><Power className="h-4 w-4" /> Activate</button>}
                    {!m.isActive && <button type="button" className="btn-ghost btn-sm text-rust-600" onClick={() => remove(m)} aria-label={`Delete ${m.version}`}><Trash2 className="h-4 w-4" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Upload a trained TF.js model"
        footer={<><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="btn-primary" disabled={busy || !form.files.length || !form.labels.trim()} onClick={upload}>{busy && <Spinner className="h-4 w-4 text-white" />} Upload</button></>}>
        <div className="space-y-4">
          <Field label="Model files" hint="Select model.json, every .bin weight shard, and (optionally) labels.json from training/output/tfjs_model">
            <input type="file" multiple accept=".json,.bin" className="input" onChange={(e) => onFiles(e.target.files)} />
          </Field>
          {form.files.length > 0 && <p className="text-xs text-ink-mute">{form.files.map((f) => f.name).join(' · ')}</p>}
          <Field label="Class labels (in model output order)" hint='Comma-separated or JSON array, e.g. A, B, C, Hello'>
            <textarea className="input font-mono" rows={3} value={form.labels} onChange={(e) => setForm({ ...form, labels: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Validation accuracy (0–1)"><input className="input" type="number" min="0" max="1" step="0.0001" value={form.valAccuracy} onChange={(e) => setForm({ ...form, valAccuracy: e.target.value })} /></Field>
            <label className="flex items-center gap-2 self-end pb-3 text-sm font-medium"><input type="checkbox" className="h-4 w-4 accent-teal-600" checked={form.activate} onChange={(e) => setForm({ ...form, activate: e.target.checked })} /> Activate now</label>
          </div>
          <Field label="Notes"><input className="input" maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
