import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { Circle, Download, Upload, Trash2, Plus, BrainCircuit, Rocket, FlaskConical, Database, Eye } from 'lucide-react';
import CameraStage from '../../components/CameraStage.jsx';
import { Badge, ConfidenceBar, Field, Modal, Spinner, pct, cx } from '../../components/ui.jsx';
import { useHandTracking } from '../../hooks/useHandTracking.js';
import { api, errMsg } from '../../api/client.js';
import { loadSamples, saveSamples, toCSV, fromCSV, stratifiedSplit } from '../../ml/dataset.js';
import { trainModel, modelToFiles, predict } from '../../ml/classifier.js';

const MIN_PER_CLASS = 20;

export default function ModelStudio() {
  const [dictionary, setDictionary] = useState([]);
  const [samples, setSamples] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [pick, setPick] = useState('');
  const [target, setTarget] = useState(80);
  const [rec, setRec] = useState(null); // { label, phase: 'countdown'|'recording', count, got }
  const [epochs, setEpochs] = useState(40);
  const [training, setTraining] = useState(false);
  const [curve, setCurve] = useState([]);
  const [trained, setTrained] = useState(null); // { model, labels, valAccuracy, confusion, samples }
  const [livePred, setLivePred] = useState(null);
  const [testMode, setTestMode] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publish, setPublish] = useState({ notes: '', activate: true });
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef(null);

  const recRef = useRef(rec);
  const trainedRef = useRef(trained);
  const testRef = useRef(testMode);
  const tick = useRef(0);
  useEffect(() => { recRef.current = rec; }, [rec]);
  useEffect(() => { trainedRef.current = trained; }, [trained]);
  useEffect(() => { testRef.current = testMode; }, [testMode]);

  useEffect(() => {
    api.get('/signs', { params: { limit: 500 } }).then(({ data }) => setDictionary(data.items)).catch((e) => toast.error(errMsg(e)));
    loadSamples().then((s) => { setSamples(s); setLoaded(true); });
  }, []);
  useEffect(() => { if (loaded) { const t = setTimeout(() => saveSamples(samples), 400); return () => clearTimeout(t); } return undefined; }, [samples, loaded]);

  const labels = useMemo(() => Object.keys(samples).sort((a, b) => {
    const ia = dictionary.find((d) => d.word === a)?.labelIndex ?? 1e9;
    const ib = dictionary.find((d) => d.word === b)?.labelIndex ?? 1e9;
    return ia - ib || a.localeCompare(b);
  }), [samples, dictionary]);
  const total = labels.reduce((n, l) => n + samples[l].length, 0);
  const ready = labels.length >= 2 && labels.every((l) => samples[l].length >= MIN_PER_CLASS);

  /* ---------------- capture */
  const onFrame = useCallback((features) => {
    const r = recRef.current;
    if (r?.phase === 'recording' && features) {
      const row = Array.from(features, (v) => +v.toFixed(5));
      setSamples((s) => ({ ...s, [r.label]: [...(s[r.label] || []), row] }));
      const got = r.got + 1;
      if (got >= r.target) { setRec(null); toast.success(`Captured ${r.target} samples for “${r.label}”`); } else setRec({ ...r, got });
      recRef.current = got >= r.target ? null : { ...r, got };
    }
    const t = trainedRef.current;
    if (testRef.current && t && tick.current++ % 2 === 0) setLivePred(features ? predict(t.model, t.labels, features) : null);
  }, []);
  const tracking = useHandTracking({ onFrame });

  useEffect(() => {
    if (rec?.phase !== 'countdown') return undefined;
    if (rec.count === 0) { setRec({ ...rec, phase: 'recording' }); return undefined; }
    const t = setTimeout(() => setRec((r) => r && { ...r, count: r.count - 1 }), 700);
    return () => clearTimeout(t);
  }, [rec]);

  const startRecording = (label) => {
    if (tracking.status !== 'running') { toast('Start the camera first'); return; }
    setTestMode(false);
    setRec({ label, phase: 'countdown', count: 3, got: 0, target });
  };

  const addClass = () => {
    if (!pick || samples[pick]) return;
    setSamples((s) => ({ ...s, [pick]: [] }));
    setPick('');
  };
  const removeClass = (label) => setSamples(({ [label]: _drop, ...rest }) => rest);
  const clearClass = (label) => setSamples((s) => ({ ...s, [label]: [] }));

  /* ---------------- import / export */
  const exportCsv = () => {
    const blob = new Blob([toCSV(samples)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `isl-landmarks-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importCsv = async (file) => {
    try {
      const incoming = fromCSV(await file.text());
      setSamples((s) => {
        const merged = { ...s };
        for (const [k, rows] of Object.entries(incoming)) merged[k] = [...(merged[k] || []), ...rows];
        return merged;
      });
      toast.success(`Imported ${Object.values(incoming).reduce((n, r) => n + r.length, 0)} samples`);
    } catch (err) { toast.error(err.message); }
  };

  /* ---------------- training */
  const train = async () => {
    setTraining(true); setCurve([]); setTrained(null); setTestMode(false);
    // Free the GPU for TF.js: MediaPipe hand tracking competing for WebGL stalls training
    if (tracking.status === 'running') tracking.stop();
    try {
      const split = stratifiedSplit(samples, labels, 0.2);
      const res = await trainModel(split, labels.length, {
        epochs,
        onEpoch: (e, logs) => setCurve((c) => [...c, { epoch: e + 1, acc: logs.acc, val: logs.val_acc, loss: logs.loss }]),
      });
      trainedRef.current?.model?.dispose?.();
      setTrained({ ...res, labels: [...labels], samples: total });
      toast.success(`Training complete — validation accuracy ${pct(res.valAccuracy, 1)}`);
    } catch (err) {
      toast.error(`Training failed: ${err.message}`);
    } finally { setTraining(false); }
  };

  const doPublish = async () => {
    setPublishing(true);
    try {
      const files = await modelToFiles(trained.model);
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      fd.append('classLabels', JSON.stringify(trained.labels));
      fd.append('valAccuracy', String(+trained.valAccuracy.toFixed(4)));
      fd.append('trainedSamples', String(trained.samples));
      fd.append('source', 'browser');
      fd.append('notes', publish.notes);
      fd.append('activate', String(publish.activate));
      const { data } = await api.post('/models', fd);
      toast.success(`Published ${data.model.version}${data.model.isActive ? ' and activated' : ''}`);
      setPublishOpen(false);
    } catch (err) { toast.error(errMsg(err)); } finally { setPublishing(false); }
  };

  const available = dictionary.filter((d) => !samples[d.word]);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-900">
        <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
        <p><strong>Model Studio</strong> trains the ISL classifier entirely in this browser: record landmark samples per sign, train a neural network on WebGL, then publish it to the model registry. Samples are saved locally on this device and can be exported as CSV for the Python pipeline.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <CameraStage
            tracking={tracking}
            overlay={
              <>
                {rec?.phase === 'countdown' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink/40 text-white">
                    <span className="text-sm font-semibold uppercase tracking-widest">Get ready to sign “{rec.label}”</span>
                    <span key={rec.count} className="animate-pop text-8xl font-extrabold">{rec.count || 'Go'}</span>
                  </div>
                )}
                {rec?.phase === 'recording' && (
                  <div className="absolute inset-x-3 bottom-3 rounded-lg bg-rust-600/90 px-4 py-3 text-white">
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span className="flex items-center gap-2"><Circle className="h-3 w-3 animate-pulse fill-white" /> Recording “{rec.label}” — vary angle & distance slightly</span>
                      <span className="font-mono">{rec.got}/{rec.target}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-white/30"><div className="h-full rounded-full bg-white" style={{ width: `${(rec.got / rec.target) * 100}%` }} /></div>
                  </div>
                )}
                {testMode && livePred && !rec && (
                  <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-lg bg-ink/75 px-4 py-3 text-white backdrop-blur">
                    <span className="text-3xl font-bold tracking-tight">{livePred.label}</span>
                    <span className="font-mono">{pct(livePred.confidence)}</span>
                  </div>
                )}
              </>
            }
          />

          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold"><BrainCircuit className="h-5 w-5 text-teal-600" /> 2 · Train</h2>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-ink-mute" htmlFor="epochs">Epochs</label>
                <input id="epochs" type="number" min="5" max="200" className="input w-20 py-1.5" value={epochs} onChange={(e) => setEpochs(Math.max(5, Math.min(200, +e.target.value || 40)))} />
                <button type="button" className="btn-primary btn-sm" disabled={!ready || training || Boolean(rec)} onClick={train}>
                  {training ? <Spinner className="h-4 w-4 text-white" /> : <BrainCircuit className="h-4 w-4" />} {training ? `Training… ${curve.length}/${epochs}` : 'Train model'}
                </button>
              </div>
            </div>
            {training && (
              <div className="mt-3">
                <p className="text-sm text-ink-mute">{curve.length === 0 ? 'Preparing model — the first epoch can take a few seconds…' : `Epoch ${curve.length} of ${epochs}. Camera paused while training; restart it afterwards to test live.`}</p>
                <div className="mt-2 h-1.5 rounded-full bg-sand-200"><div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${(curve.length / epochs) * 100}%` }} /></div>
              </div>
            )}
            {!ready && <p className="mt-2 text-sm text-ink-mute">Add at least 2 signs with {MIN_PER_CLASS}+ samples each to enable training.</p>}
            {curve.length > 0 && (
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={curve} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="epoch" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis domain={[0, 1]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(3) : v)} contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13 }} />
                    <Legend iconType="plainline" />
                    <Line type="monotone" dataKey="acc" name="Train accuracy" stroke="#0F766E" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="val" name="Validation accuracy" stroke="#D97706" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {trained && (
              <div className="mt-5 space-y-4 border-t border-sand-200 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-3xl font-bold tracking-tight">{pct(trained.valAccuracy, 1)}</p>
                    <p className="text-xs text-ink-mute">validation accuracy · {trained.labels.length} classes · {trained.samples} samples</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className={cx('btn-sm', testMode ? 'btn-accent' : 'btn-outline')} onClick={() => setTestMode((t) => !t)} disabled={tracking.status !== 'running'}>
                      <Eye className="h-4 w-4" /> {testMode ? 'Testing live' : 'Test live'}
                    </button>
                    <button type="button" className="btn-primary btn-sm" onClick={() => setPublishOpen(true)}><Rocket className="h-4 w-4" /> Publish</button>
                  </div>
                </div>
                <details className="rounded-lg border border-sand-200 bg-sand-50 p-3">
                  <summary className="cursor-pointer text-sm font-semibold">Confusion matrix (validation set)</summary>
                  <div className="mt-3 overflow-x-auto">
                    <table className="text-xs">
                      <thead><tr><th className="px-2 py-1 text-left text-ink-mute">true ↓ / pred →</th>{trained.labels.map((l) => <th key={l} className="px-2 py-1 font-mono">{l}</th>)}</tr></thead>
                      <tbody>
                        {trained.confusion.map((row, i) => {
                          const sum = row.reduce((a, b) => a + b, 0) || 1;
                          return (
                            <tr key={trained.labels[i]}>
                              <th className="px-2 py-1 text-left font-mono">{trained.labels[i]}</th>
                              {row.map((v, j) => (
                                <td key={j} className="px-2 py-1 text-center font-mono" style={{ background: v ? (i === j ? `rgba(16,185,129,${0.15 + 0.6 * (v / sum)})` : `rgba(239,68,68,${0.15 + 0.6 * (v / sum)})`) : undefined }}>{v || ''}</td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            )}
          </section>
        </div>

        <section className="card flex flex-col p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold"><Database className="h-5 w-5 text-teal-600" /> 1 · Collect data</h2>
            <Badge tone="sand">{total} samples</Badge>
          </div>
          <div className="mt-4 flex gap-2">
            <select className="input" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Sign to add">
              <option value="">Add a sign from the dictionary…</option>
              {available.map((d) => <option key={d._id} value={d.word}>{d.word} · {d.category}</option>)}
            </select>
            <button type="button" className="btn-outline" onClick={addClass} disabled={!pick}><Plus className="h-4 w-4" /></button>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-ink-mute">
            <span>Samples per recording</span>
            <input type="number" min="20" max="400" step="10" className="input w-20 py-1" value={target} onChange={(e) => setTarget(Math.max(20, Math.min(400, +e.target.value || 80)))} />
          </div>

          <ul className="mt-4 flex-1 space-y-2 overflow-y-auto lg:max-h-[30rem]">
            {labels.length === 0 && <li className="rounded-lg border border-dashed border-sand-300 bg-sand-50 p-4 text-sm text-ink-mute">No signs yet. Tip: start with 3–5 visually distinct signs (e.g. A, B, C, Hello) and 80+ samples each.</li>}
            {labels.map((l) => {
              const n = samples[l].length;
              return (
                <li key={l} className="flex items-center gap-3 rounded-lg border border-sand-200 p-3">
                  <span className="w-20 truncate font-semibold">{l}</span>
                  <div className="flex-1">
                    <ConfidenceBar neutral value={Math.min(1, n / 100)} threshold={MIN_PER_CLASS / 100} />
                    <span className="mt-1 block font-mono text-[11px] text-ink-mute">{n} samples</span>
                  </div>
                  <button type="button" className="btn-accent btn-sm" disabled={Boolean(rec) || training} onClick={() => startRecording(l)}><Circle className="h-3 w-3 fill-white" /> Rec</button>
                  <button type="button" className="btn-ghost btn-sm" title="Clear samples" disabled={!n || Boolean(rec)} onClick={() => clearClass(l)}><Trash2 className="h-4 w-4" /></button>
                  <button type="button" className="btn-ghost btn-sm text-rust-600" title="Remove sign" disabled={Boolean(rec)} onClick={() => removeClass(l)}>×</button>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-sand-200 pt-4">
            <button type="button" className="btn-outline btn-sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Import CSV</button>
            <button type="button" className="btn-outline btn-sm" disabled={!total} onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { if (e.target.files[0]) importCsv(e.target.files[0]); e.target.value = ''; }} />
          </div>
        </section>
      </div>

      <Modal open={publishOpen} onClose={() => setPublishOpen(false)} title="Publish model"
        footer={<><button type="button" className="btn-ghost" onClick={() => setPublishOpen(false)}>Cancel</button><button type="button" className="btn-primary" disabled={publishing} onClick={doPublish}>{publishing && <Spinner className="h-4 w-4 text-white" />} Publish</button></>}>
        {trained && (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">This uploads <code>model.json</code> and its weights to the registry as the next version. Classes: <strong>{trained.labels.join(', ')}</strong>.</p>
            <Field label="Release notes"><textarea className="input" rows={3} maxLength={500} value={publish.notes} onChange={(e) => setPublish({ ...publish, notes: e.target.value })} placeholder="e.g. Added Hello and Thank You, 120 samples per class" /></Field>
            <label className="flex items-center gap-3 text-sm font-medium">
              <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={publish.activate} onChange={(e) => setPublish({ ...publish, activate: e.target.checked })} />
              Make this the active model for all users
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
