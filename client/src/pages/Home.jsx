import { Link } from 'react-router-dom';
import { ArrowRight, Camera, Cpu, Volume2, ShieldCheck, Zap, BookOpen, Hand, CheckCircle2, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

// Stylised 21-point hand skeleton for the hero illustration
const PTS = [
  [120, 250], [92, 228], [74, 196], [62, 168], [50, 142], [104, 160], [100, 116], [98, 88], [96, 62],
  [126, 156], [128, 106], [130, 72], [131, 44], [146, 162], [154, 118], [158, 88], [161, 62],
  [164, 174], [178, 140], [186, 116], [192, 94],
];
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];

function HandGraphic() {
  return (
    <svg viewBox="20 20 200 250" className="h-full w-full" role="img" aria-label="Illustration of 21 hand landmarks">
      {BONES.map(([a, b]) => (
        <line key={`${a}-${b}`} x1={PTS[a][0]} y1={PTS[a][1]} x2={PTS[b][0]} y2={PTS[b][1]} stroke="#2DD4BF" strokeOpacity=".85" strokeWidth="3" strokeLinecap="round" />
      ))}
      {PTS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 0 ? 6.5 : 4.5} fill="#0F172A" stroke={i === 0 ? '#F59E0B' : '#5EEAD4'} strokeWidth="2.5" />
      ))}
    </svg>
  );
}

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-4 rounded-[1.75rem] bg-gradient-to-tr from-teal-100 via-white to-amber-50 blur-2xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-lift">
        <div className="flex items-center gap-1.5 border-b border-sand-200 bg-sand-50 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-sand-300" /><span className="h-2.5 w-2.5 rounded-full bg-sand-300" /><span className="h-2.5 w-2.5 rounded-full bg-sand-300" />
          <span className="ml-3 text-xs font-medium text-ink-mute">Live translator</span>
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-moss-600"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-moss-500" /> On-device</span>
        </div>
        <div className="relative aspect-[4/3] bg-gradient-to-br from-ink to-teal-900 p-6">
          <div className="bg-grid absolute inset-0 opacity-[.08] invert" aria-hidden="true" />
          <div className="relative mx-auto h-full w-3/5"><HandGraphic /></div>
          <div className="absolute left-4 top-4 flex gap-1.5">
            <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">1 hand</span>
            <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">30 FPS</span>
          </div>
        </div>
        <div className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-ink-mute">Recognised sign</p>
              <p className="text-2xl font-bold tracking-tight">Hello</p>
            </div>
            <span className="chip bg-moss-50 text-moss-600 ring-1 ring-inset ring-moss-600/20"><CheckCircle2 className="h-3.5 w-3.5" /> 96%</span>
          </div>
          <div className="h-2 rounded-full bg-sand-200"><div className="h-full w-[96%] rounded-full bg-moss-500" /></div>
          <div className="flex items-center gap-2 rounded-lg bg-sand-50 px-3 py-2 text-sm text-ink-soft">
            <Volume2 className="h-4 w-4 text-teal-600" /> “Hello, how are you?”
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { icon: Camera, title: 'Capture', text: 'Your webcam feed is read by the browser at up to 30 frames per second.' },
  { icon: Hand, title: 'Track', text: 'MediaPipe locates 21 3D landmarks on each hand — no gloves or sensors.' },
  { icon: Cpu, title: 'Classify', text: 'A TensorFlow.js neural network maps normalised landmarks to an ISL sign.' },
  { icon: Volume2, title: 'Speak', text: 'Signs appear as live captions and are read aloud with the Web Speech API.' },
];

const PILLARS = [
  { icon: ShieldCheck, title: 'Private by design', text: 'Video never leaves your device. Only recognised text is saved, and only when you are signed in.' },
  { icon: Zap, title: 'Real-time on any laptop', text: 'Inference runs on WebGL in the browser — no streaming lag, no GPU servers, no cloud bill.' },
  { icon: BookOpen, title: 'Learn as you go', text: 'Practise signs with instant accuracy feedback and track mastery across the ISL dictionary.' },
];

const STATS = [['42', '3D landmarks tracked'], ['30+', 'frames per second'], ['0', 'videos uploaded'], ['100%', 'in-browser inference']];

export default function Home() {
  const { user } = useAuth();
  return (
    <>
      <section className="relative overflow-hidden border-b border-sand-200 bg-white">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" aria-hidden="true" />
        <div className="container-x relative grid items-center gap-14 py-16 lg:grid-cols-[1.1fr_.9fr] lg:py-24">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
              <Sparkles className="h-3.5 w-3.5" /> Indian Sign Language · Real-time · On-device
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Translate sign language into <span className="text-teal-600">text and speech</span>, instantly.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-ink-mute">
              SignBridge recognises ISL gestures from any webcam and turns them into captions and voice — bridging conversations
              between Deaf and hearing people without special hardware.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/translate" className="btn-primary btn-lg">Start translating <ArrowRight className="h-4 w-4" /></Link>
              <Link to={user ? '/learn' : '/register'} className="btn-outline btn-lg">{user ? 'Continue learning' : 'Create a free account'}</Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-mute">
              {['No installation', 'Works in Chrome & Edge', 'Free to use'].map((t) => (
                <li key={t} className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-teal-600" /> {t}</li>
              ))}
            </ul>
          </div>
          <ProductPreview />
        </div>
      </section>

      <section className="border-b border-sand-200 bg-sand-50">
        <dl className="container-x grid grid-cols-2 gap-px py-10 lg:grid-cols-4">
          {STATS.map(([v, l]) => (
            <div key={l} className="px-4 py-2 text-center">
              <dt className="text-3xl font-bold tracking-tight text-ink">{v}</dt>
              <dd className="mt-1 text-sm text-ink-mute">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="container-x py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">From gesture to voice in four steps</h2>
          <p className="mt-4 text-ink-mute">Every step runs locally in your browser, so translation is instant and your camera feed stays private.</p>
        </div>
        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="card relative p-6 transition-shadow hover:shadow-lift">
              <div className="flex items-center justify-between">
                <div className="inline-flex rounded-lg bg-teal-50 p-2.5 text-teal-600 ring-1 ring-inset ring-teal-600/10"><Icon className="h-5 w-5" /></div>
                <span className="font-mono text-xs font-semibold text-ink-mute">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-base font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-ink-mute">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-sand-200 bg-white">
        <div className="container-x grid gap-10 py-20 md:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <div className="inline-flex rounded-lg bg-ink p-2.5 text-white"><Icon className="h-5 w-5" /></div>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 leading-7 text-ink-mute">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-x py-20">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink to-teal-900 px-6 py-14 text-center sm:px-12">
          <div className="bg-grid absolute inset-0 opacity-[.07] invert" aria-hidden="true" />
          <div className="relative">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Ready to start a conversation?</h2>
            <p className="mx-auto mt-4 max-w-xl text-white/70">Open the translator, allow camera access and start signing. No downloads, no sign-up required.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/translate" className="btn btn-lg bg-white text-ink hover:bg-sand-100">Open the translator <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/dictionary" className="btn btn-lg border border-white/20 text-white hover:bg-white/10">Browse the dictionary</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
