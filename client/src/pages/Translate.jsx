import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Volume2, VolumeX, Delete, Eraser, Copy, Space, Settings2, Info, RefreshCw, Sparkles,
} from 'lucide-react';
import CameraStage from '../components/CameraStage.jsx';
import { Alert, Badge, ConfidenceBar, PageHeader, pct, cx } from '../components/ui.jsx';
import { useHandTracking } from '../hooks/useHandTracking.js';
import { useActiveModel } from '../hooks/useActiveModel.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { useAuth } from '../context/AuthContext.jsx';
import { predict } from '../ml/classifier.js';
import { GestureSmoother } from '../ml/smoother.js';
import { api } from '../api/client.js';

const SETTINGS_KEY = 'signbridge.translator';
const DEFAULTS = { threshold: 0.8, window: 12, autoSpeak: true };
const readSettings = () => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return DEFAULTS; }
};

/** Single characters (letters, digits) are spelled into the current word; words are separated by spaces. */
const appendToken = (text, token) => {
  if (token.length === 1) return text + token;
  return `${text}${text && !text.endsWith(' ') ? ' ' : ''}${token} `;
};

export default function Translate() {
  const { user } = useAuth();
  const model = useActiveModel();
  const { speak, supported: ttsSupported, cancel } = useSpeech(user?.preferredLang);

  const [settings, setSettings] = useState(readSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [live, setLive] = useState(null); // { label, confidence, top: [{label, p}] , latency }
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState('');
  const [recent, setRecent] = useState([]);

  const smoother = useMemo(() => new GestureSmoother(settings), []); // eslint-disable-line react-hooks/exhaustive-deps
  const modelRef = useRef(model);
  const settingsRef = useRef(settings);
  const sessionRef = useRef(null);
  const frameRef = useRef(0);
  const speakRef = useRef(speak);

  useEffect(() => { modelRef.current = model; }, [model]);
  useEffect(() => { speakRef.current = speak; }, [speak]);
  useEffect(() => {
    settingsRef.current = settings;
    smoother.configure(settings);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings, smoother]);

  const commit = useCallback((label, confidence, latencyMs) => {
    setText((t) => appendToken(t, label));
    setRecent((r) => [{ label, confidence, at: Date.now() }, ...r].slice(0, 8));
    const spoken = settingsRef.current.autoSpeak && speakRef.current(label);
    if (user && sessionRef.current) {
      api.post('/translations', {
        sessionId: sessionRef.current, recognizedText: label, confidence: +confidence.toFixed(4), latencyMs: Math.round(latencyMs), spoken: Boolean(spoken),
      }).catch(() => { /* logging must never interrupt translation */ });
    }
  }, [user]);

  const onFrame = useCallback((features) => {
    const m = modelRef.current;
    if (m.status !== 'ready') return;
    if (!features) {
      smoother.push(null);
      if (frameRef.current++ % 3 === 0) { setLive(null); setProgress(0); }
      return;
    }
    const p = predict(m.model, m.meta.classLabels, features);
    const { commit: c, progress: prog } = smoother.push(p);
    if (c) commit(c.label, c.confidence, p.latencyMs);
    // Throttle UI updates to ~15 Hz
    if (frameRef.current++ % 2 === 0) {
      const top = Array.from(p.probs).map((v, i) => ({ label: m.meta.classLabels[i], p: v })).sort((a, b) => b.p - a.p).slice(0, 3);
      setLive({ label: p.label, confidence: p.confidence, top, latency: p.latencyMs });
      setProgress(prog);
    }
  }, [commit, smoother]);

  const tracking = useHandTracking({ onFrame });

  // Session lifecycle: one session per camera run (signed-in users only)
  useEffect(() => {
    if (tracking.status === 'running' && user && model.status === 'ready' && !sessionRef.current) {
      api.post('/sessions', {
        modelVersionId: model.meta._id,
        device: { browser: navigator.userAgent.slice(0, 200), backend: model.backend || '', fps: 0 },
      }).then(({ data }) => { sessionRef.current = data.session._id; }).catch(() => {});
    }
    if (tracking.status !== 'running' && sessionRef.current) {
      const id = sessionRef.current;
      sessionRef.current = null;
      smoother.reset();
      api.patch(`/sessions/${id}/end`, { fps: tracking.fps }).catch(() => {});
    }
  }, [tracking.status, user, model.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (sessionRef.current) api.patch(`/sessions/${sessionRef.current}/end`, {}).catch(() => {});
    cancel();
  }, [cancel]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(text.trim()); toast.success('Copied to clipboard'); } catch { toast.error('Copy failed'); }
  };

  return (
    <div className="container-x py-10">
      <PageHeader
        eyebrow="Live translator"
        title="Sign to text & speech"
        subtitle="Hold each sign steady for about half a second. Letters spell a word; words are added with spaces."
        actions={
          <>
            {model.status === 'ready' && <Badge tone="teal"><Sparkles className="h-3.5 w-3.5" /> Model {model.meta.version} · {model.meta.numClasses} signs</Badge>}
            <button type="button" className="btn-outline btn-sm" onClick={() => setShowSettings((s) => !s)} aria-expanded={showSettings}>
              <Settings2 className="h-4 w-4" /> Settings
            </button>
          </>
        }
      />

      {model.status === 'none' && (
        <Alert tone="warning" title="No recognition model is published yet" className="mb-6">
          Hand tracking still works. An administrator can record samples and publish a model in <strong>Admin → Model Studio</strong>, or upload one trained with the Python pipeline.
        </Alert>
      )}
      {model.status === 'error' && (
        <Alert tone="error" title="Could not load the recognition model" className="mb-6"
          action={<button type="button" className="btn-outline btn-sm" onClick={model.refresh}><RefreshCw className="h-4 w-4" /> Retry</button>}>
          {model.error}
        </Alert>
      )}

      {showSettings && (
        <div className="card mb-6 grid animate-pop gap-6 p-5 sm:grid-cols-3">
          <label className="block">
            <span className="label">Confidence threshold · {pct(settings.threshold)}</span>
            <input type="range" min="0.5" max="0.99" step="0.01" value={settings.threshold} className="w-full accent-teal-600"
              onChange={(e) => setSettings({ ...settings, threshold: +e.target.value })} />
          </label>
          <label className="block">
            <span className="label">Hold time · {settings.window} frames</span>
            <input type="range" min="5" max="30" step="1" value={settings.window} className="w-full accent-teal-600"
              onChange={(e) => setSettings({ ...settings, window: +e.target.value })} />
          </label>
          <label className="flex items-center gap-3 self-end">
            <input type="checkbox" className="h-4 w-4 accent-teal-600" checked={settings.autoSpeak} disabled={!ttsSupported}
              onChange={(e) => setSettings({ ...settings, autoSpeak: e.target.checked })} />
            <span className="text-sm font-medium">Speak each sign automatically {!ttsSupported && '(not supported)'}</span>
          </label>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <CameraStage
          tracking={tracking}
          overlay={live && (
            <div className="absolute inset-x-3 bottom-3 animate-pop rounded-lg bg-ink/75 px-4 py-3 text-white backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <span className="text-3xl font-bold tracking-tight">{live.label}</span>
                <span className="font-mono text-sm">{pct(live.confidence)}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-amber-500 transition-[width]" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          )}
        />

        <div className="flex flex-col gap-6">
          <section className="card flex flex-1 flex-col p-5" aria-labelledby="out-h">
            <div className="flex items-center justify-between">
              <h2 id="out-h" className="text-base font-semibold">Translation</h2>
              {!user && <Link to="/login" className="link text-xs">Sign in to save history</Link>}
            </div>
            <div className="mt-3 min-h-[7rem] flex-1 rounded-lg border border-sand-200 bg-sand-50 p-4 text-2xl font-semibold leading-snug tracking-tight text-ink" aria-live="polite">
              {text || <span className="text-base font-normal text-ink-mute">Recognised signs will appear here…</span>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn-primary btn-sm" disabled={!text.trim() || !ttsSupported} onClick={() => speak(text.trim())}><Volume2 className="h-4 w-4" /> Speak</button>
              <button type="button" className="btn-outline btn-sm" onClick={() => setText((t) => (t.endsWith(' ') || !t ? t : `${t} `))}><Space className="h-4 w-4" /> Space</button>
              <button type="button" className="btn-outline btn-sm" disabled={!text} onClick={() => setText((t) => t.replace(/\s+$/, '').slice(0, -1))}><Delete className="h-4 w-4" /> Back</button>
              <button type="button" className="btn-outline btn-sm" disabled={!text} onClick={copy}><Copy className="h-4 w-4" /> Copy</button>
              <button type="button" className="btn-ghost btn-sm" disabled={!text} onClick={() => setText('')}><Eraser className="h-4 w-4" /> Clear</button>
              <button type="button" className="btn-ghost btn-sm" onClick={cancel} aria-label="Stop speaking"><VolumeX className="h-4 w-4" /></button>
            </div>
          </section>

          <section className="card p-5" aria-labelledby="live-h">
            <h2 id="live-h" className="text-base font-semibold">Live prediction</h2>
            {live ? (
              <ul className="mt-4 space-y-3">
                {live.top.map((t, i) => (
                  <li key={t.label}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className={cx(i === 0 ? 'font-semibold text-ink' : 'text-ink-soft')}>{t.label}</span>
                      <span className="font-mono text-xs text-ink-mute">{pct(t.p, 1)}</span>
                    </div>
                    <ConfidenceBar value={t.p} threshold={i === 0 ? settings.threshold : undefined} />
                  </li>
                ))}
                <li className="pt-1 text-xs text-ink-mute">Inference {live.latency.toFixed(1)} ms · backend {model.backend}</li>
              </ul>
            ) : (
              <p className="mt-3 flex items-start gap-2 text-sm text-ink-soft">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-mute" />
                {tracking.status === 'running' ? 'Show your hand(s) to the camera, about an arm’s length away, with light in front of you.' : 'Start the camera to begin.'}
              </p>
            )}
            {recent.length > 0 && (
              <div className="mt-5 border-t border-sand-200 pt-4">
                <p className="label">Recent</p>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => <Badge key={r.at} tone="sand">{r.label} <span className="font-mono text-[10px] text-ink-mute">{pct(r.confidence)}</span></Badge>)}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
