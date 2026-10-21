import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowRight, ExternalLink, Play, Trophy, Target, GraduationCap, Lock, RotateCcw } from 'lucide-react';
import { api, errMsg } from '../api/client.js';
import CameraStage from '../components/CameraStage.jsx';
import { Badge, ConfidenceBar, EmptyState, PageHeader, PageLoader, StatCard, pct, cx } from '../components/ui.jsx';
import { useHandTracking } from '../hooks/useHandTracking.js';
import { useActiveModel } from '../hooks/useActiveModel.js';
import { predict } from '../ml/classifier.js';
import { islrtcLink } from './Dictionary.jsx';

const ATTEMPT_MS = 4000;
const STATUS_TONE = { mastered: 'moss', learning: 'amber', new: 'sand' };

function Ring({ value }) {
  const r = 34; const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90" aria-label={`${pct(value)} complete`}>
      <circle cx="40" cy="40" r={r} fill="none" stroke="#E2E8F0" strokeWidth="8" />
      <circle cx="40" cy="40" r={r} fill="none" stroke="#0F766E" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} />
    </svg>
  );
}

function Overview({ signs, progress, summary, modelLabels }) {
  const byId = new Map(progress.map((p) => [p.signId?._id, p]));
  return (
    <div className="container-x py-10">
      <PageHeader eyebrow="Learn ISL" title="Practise with instant feedback" subtitle="Pick a sign, watch the reference, then perform it for the camera. Reach 85% accuracy to master it." />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card flex items-center gap-4 p-5">
          <div className="relative"><Ring value={summary.completion} /><span className="absolute inset-0 flex items-center justify-center text-lg font-bold">{pct(summary.completion)}</span></div>
          <div><p className="text-sm font-medium text-ink-mute">Dictionary mastered</p><p className="text-sm text-ink-soft">{summary.mastered} of {summary.totalSigns} signs</p></div>
        </div>
        <StatCard icon={Trophy} label="Mastered" value={summary.mastered} tone="moss" />
        <StatCard icon={Target} label="In progress" value={summary.learning} tone="amber" />
        <StatCard icon={GraduationCap} label="Practisable now" value={modelLabels.size} hint="Signs in the active model" />
      </div>

      {modelLabels.size === 0 ? (
        <EmptyState icon={Lock} title="Practice unlocks once a model is published">An administrator needs to publish a recognition model before signs can be practised.</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {signs.map((s) => {
            const p = byId.get(s._id);
            const available = modelLabels.has(s.word);
            const content = (
              <>
                <span className={cx('font-bold tracking-tight', s.word.length <= 2 ? 'text-4xl' : 'text-lg')}>{s.word}</span>
                <div className="mt-auto pt-3">
                  {available ? (
                    <>
                      <Badge tone={STATUS_TONE[p?.status || 'new']} className="capitalize">{p?.status || 'new'}</Badge>
                      {p && <div className="mt-2"><ConfidenceBar value={p.bestAccuracy} threshold={0.85} /></div>}
                    </>
                  ) : <Badge tone="sand"><Lock className="h-3 w-3" /> Not in model</Badge>}
                </div>
              </>
            );
            return (
              <li key={s._id}>
                {available ? (
                  <Link to={`/learn/${s._id}`} className="card flex h-full flex-col p-4 transition hover:border-teal-500/40 hover:shadow-lift">{content}</Link>
                ) : (
                  <div className="card flex h-full flex-col bg-sand-50 p-4 text-ink-mute shadow-none">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Practice({ sign, model, onDone, nextId }) {
  const navigate = useNavigate();
  const targetIdx = model.meta.classLabels.indexOf(sign.word);
  const [phase, setPhase] = useState('ready'); // ready | countdown | recording | result
  const [count, setCount] = useState(3);
  const [liveP, setLiveP] = useState(0);
  const [result, setResult] = useState(null);
  const samples = useRef([]);
  const phaseRef = useRef(phase);
  const tick = useRef(0);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const onFrame = useCallback((features) => {
    if (!features) { if (tick.current++ % 3 === 0) setLiveP(0); return; }
    const p = predict(model.model, model.meta.classLabels, features);
    const target = p.probs[targetIdx];
    if (phaseRef.current === 'recording') samples.current.push(target);
    if (tick.current++ % 2 === 0) setLiveP(target);
  }, [model, targetIdx]);
  const tracking = useHandTracking({ onFrame });

  const finish = useCallback(async () => {
    const s = [...samples.current].sort((a, b) => b - a);
    // Score = mean of the best half of frames with a visible hand (rewards holding the correct pose)
    const best = s.slice(0, Math.max(1, Math.ceil(s.length / 2)));
    const accuracy = s.length ? best.reduce((a, b) => a + b, 0) / best.length : 0;
    setResult({ accuracy, frames: s.length });
    setPhase('result');
    try {
      const { data } = await api.post('/progress/attempt', { signId: sign._id, accuracy: +accuracy.toFixed(4) });
      if (data.progress.status === 'mastered' && data.improved) toast.success(`“${sign.word}” mastered!`);
      onDone();
    } catch (err) { toast.error(errMsg(err)); }
  }, [sign, onDone]);

  const startAttempt = () => {
    samples.current = [];
    setResult(null);
    setCount(3);
    setPhase('countdown');
  };

  useEffect(() => {
    if (phase === 'countdown') {
      if (count === 0) { setPhase('recording'); return undefined; }
      const t = setTimeout(() => setCount((c) => c - 1), 700);
      return () => clearTimeout(t);
    }
    if (phase === 'recording') {
      const t = setTimeout(finish, ATTEMPT_MS);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [phase, count, finish]);

  const running = tracking.status === 'running';

  return (
    <div className="container-x py-10">
      <Link to="/learn" className="btn-ghost btn-sm mb-6"><ArrowLeft className="h-4 w-4" /> All signs</Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <aside className="card p-6">
          <p className="eyebrow capitalize">{sign.category}</p>
          <h1 className="mt-2 text-5xl font-extrabold tracking-tight">{sign.word}</h1>
          <p className="mt-4 leading-7 text-ink-soft">{sign.description}</p>
          {sign.howTo?.length > 0 && (
            <ol className="mt-5 list-decimal space-y-1.5 pl-5 text-sm text-ink-soft">{sign.howTo.map((h) => <li key={h}>{h}</li>)}</ol>
          )}
          <a href={islrtcLink(sign.word)} target="_blank" rel="noreferrer" className="btn-outline mt-6 w-full"><ExternalLink className="h-4 w-4" /> Watch the ISLRTC reference</a>
        </aside>

        <div className="space-y-4">
          <CameraStage
            tracking={tracking}
            overlay={
              <>
                {phase === 'countdown' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-ink/30">
                    <span key={count} className="animate-pop text-8xl font-extrabold text-white drop-shadow">{count || 'Go'}</span>
                  </div>
                )}
                {phase === 'recording' && (
                  <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/20">
                    <div className="h-full bg-amber-500" style={{ animation: `grow ${ATTEMPT_MS}ms linear forwards` }} />
                    <style>{'@keyframes grow{from{width:0}to{width:100%}}'}</style>
                  </div>
                )}
              </>
            }
          />
          <div className="card p-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold">Match with “{sign.word}”</span>
              <span className="font-mono text-ink-mute">{pct(liveP)}</span>
            </div>
            <ConfidenceBar value={liveP} threshold={0.85} />

            {phase === 'result' && result && (
              <div className={cx('mt-5 animate-pop rounded-lg border p-4', result.accuracy >= 0.85 ? 'border-moss-500/20 bg-moss-50' : 'border-amber-500/20 bg-amber-50')}>
                <p className="text-2xl font-bold">{pct(result.accuracy)} accuracy</p>
                <p className="text-sm text-ink-soft">
                  {result.frames === 0 ? 'No hands were detected — make sure your hands are in view.'
                    : result.accuracy >= 0.85 ? 'Excellent — that counts as mastered.' : 'Close! Check the reference and try holding the final hand-shape a little longer.'}
                </p>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={!running || phase === 'countdown' || phase === 'recording'} onClick={startAttempt}>
                {phase === 'result' ? <><RotateCcw className="h-4 w-4" /> Try again</> : <><Play className="h-4 w-4" /> Start attempt</>}
              </button>
              {nextId && <button type="button" className="btn-outline" onClick={() => { setPhase('ready'); setResult(null); navigate(`/learn/${nextId}`); }}>Next sign <ArrowRight className="h-4 w-4" /></button>}
              {!running && <span className="self-center text-sm text-ink-mute">Start the camera first.</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Learn() {
  const { signId } = useParams();
  const model = useActiveModel();
  const [signs, setSigns] = useState(null);
  const [prog, setProg] = useState({ items: [], summary: null });

  const loadProgress = useCallback(() => api.get('/progress/me').then(({ data }) => setProg(data)).catch(() => {}), []);

  useEffect(() => {
    api.get('/signs', { params: { limit: 500 } }).then(({ data }) => setSigns(data.items)).catch((e) => toast.error(errMsg(e)));
    loadProgress();
  }, [loadProgress]);

  const modelLabels = useMemo(() => new Set(model.meta?.classLabels || []), [model.meta]);

  if (!signs || !prog.summary || model.status === 'loading') return <PageLoader label="Preparing your lessons…" />;

  if (signId) {
    const sign = signs.find((s) => s._id === signId);
    if (!sign) return <div className="container-x py-10"><EmptyState title="Sign not found" action={<Link to="/learn" className="btn-primary">Back to lessons</Link>} /></div>;
    if (model.status !== 'ready' || !modelLabels.has(sign.word)) {
      return <div className="container-x py-10"><EmptyState icon={Lock} title={`“${sign.word}” can’t be practised yet`} action={<Link to="/learn" className="btn-primary">Back to lessons</Link>}>This sign is not part of the currently published recognition model.</EmptyState></div>;
    }
    const practisable = signs.filter((s) => modelLabels.has(s.word));
    const idx = practisable.findIndex((s) => s._id === signId);
    const nextId = practisable[(idx + 1) % practisable.length]?._id;
    return <Practice key={sign._id} sign={sign} model={model} onDone={loadProgress} nextId={nextId !== signId ? nextId : null} />;
  }

  return <Overview signs={signs} progress={prog.items} summary={prog.summary} modelLabels={modelLabels} />;
}
