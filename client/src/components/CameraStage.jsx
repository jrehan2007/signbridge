import { Camera, CameraOff, Hand, Cpu, Gauge, ShieldCheck } from 'lucide-react';
import { Spinner, cx } from './ui.jsx';

/**
 * Mirrored webcam view with landmark overlay and live status chips.
 * `tracking` is the object returned by useHandTracking().
 */
export default function CameraStage({ tracking, children, overlay, className }) {
  const { videoRef, canvasRef, start, stop, status, error, fps, handsVisible, delegate } = tracking;
  const running = status === 'running';

  return (
    <div className={cx('relative overflow-hidden rounded-xl bg-ink shadow-lift ring-1 ring-ink/10', className)}>
      <div className="relative aspect-[4/3] w-full sm:aspect-video">
        <video ref={videoRef} className="mirror absolute inset-0 h-full w-full object-cover" playsInline muted aria-label="Your camera preview" />
        <canvas ref={canvasRef} className="mirror pointer-events-none absolute inset-0 h-full w-full object-cover" aria-hidden="true" />

        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-ink to-teal-900 p-6 text-center text-white">
            {status === 'loading' ? (
              <>
                <Spinner className="h-8 w-8 text-white" />
                <div>
                  <p className="font-semibold">Starting camera…</p>
                  <p className="mt-1 text-sm text-white/60">Loading the hand-tracking model. This takes a few seconds the first time.</p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-full bg-white/10 p-4 ring-8 ring-white/5"><Camera className="h-7 w-7" /></div>
                <div>
                  <p className="text-lg font-semibold">Camera is off</p>
                  <p className="mt-1 max-w-sm text-sm text-white/60">Video is processed on this device only — nothing is uploaded.</p>
                </div>
                {error && <p className="max-w-md rounded-lg border border-rust-500/30 bg-rust-500/15 px-3 py-2 text-sm text-rust-50">{error}</p>}
                <button type="button" className="btn bg-white text-ink shadow-sm hover:bg-sand-100" onClick={start}><Camera className="h-4 w-4" /> Start camera</button>
              </>
            )}
          </div>
        )}

        {running && (
          <>
            <div className="absolute left-3 top-3 flex flex-wrap gap-2">
              <span className={cx('chip backdrop-blur', handsVisible ? 'bg-moss-600/90 text-white' : 'bg-ink/60 text-white')}>
                <Hand className="h-3.5 w-3.5" /> {handsVisible ? `${handsVisible} hand${handsVisible > 1 ? 's' : ''}` : 'No hands'}
              </span>
              <span className="chip bg-ink/60 text-white backdrop-blur"><Gauge className="h-3.5 w-3.5" /> {fps} FPS</span>
              {delegate && <span className="chip bg-ink/60 text-white backdrop-blur"><Cpu className="h-3.5 w-3.5" /> {delegate}</span>}
            </div>
            <div className="absolute right-3 top-3 flex gap-2">
              <span className="chip bg-ink/60 text-white backdrop-blur"><ShieldCheck className="h-3.5 w-3.5" /> On-device</span>
              <button type="button" className="chip bg-white/95 font-semibold text-ink transition-colors hover:bg-white" onClick={stop}>
                <CameraOff className="h-3.5 w-3.5" /> Stop
              </button>
            </div>
            {overlay}
          </>
        )}
      </div>
      {children}
    </div>
  );
}
