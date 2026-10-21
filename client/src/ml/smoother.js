/**
 * Temporal smoothing for frame-by-frame predictions.
 *
 * A sign is "committed" (added to the sentence, spoken, logged) only when the same label
 * wins ≥ `agreement` of the last `window` frames with mean confidence ≥ `threshold`.
 * The same sign is not committed twice in a row until the signer "releases"
 * (hands leave the frame or a different sign becomes stable) — so holding a pose
 * does not spam "A A A A".
 */
export class GestureSmoother {
  constructor({ window = 12, threshold = 0.8, agreement = 0.75 } = {}) {
    this.configure({ window, threshold, agreement });
    this.reset();
  }

  configure({ window, threshold, agreement }) {
    if (window !== undefined) this.window = Math.max(3, Math.round(window));
    if (threshold !== undefined) this.threshold = threshold;
    if (agreement !== undefined) this.agreement = agreement;
  }

  reset() {
    this.buffer = [];
    this.lastCommitted = null;
    this.released = true;
    this.emptyFrames = 0;
  }

  /**
   * @param {{label:string, confidence:number}|null} pred  null when no hand is visible
   * @returns {{ stable: {label, confidence}|null, commit: {label, confidence}|null, progress: number }}
   */
  push(pred) {
    if (!pred) {
      this.emptyFrames += 1;
      if (this.emptyFrames >= 3) { // short dropouts are ignored
        this.buffer = [];
        this.released = true;
      }
      return { stable: null, commit: null, progress: 0 };
    }
    this.emptyFrames = 0;
    this.buffer.push(pred);
    if (this.buffer.length > this.window) this.buffer.shift();

    const counts = new Map();
    for (const p of this.buffer) {
      const c = counts.get(p.label) || { n: 0, conf: 0 };
      c.n += 1;
      c.conf += p.confidence;
      counts.set(p.label, c);
    }
    let best = null;
    for (const [label, c] of counts) if (!best || c.n > best.n) best = { label, n: c.n, conf: c.conf / c.n };

    const needed = Math.ceil(this.window * this.agreement);
    const progress = Math.min(1, best.n / needed);
    const isStable = this.buffer.length >= needed && best.n >= needed && best.conf >= this.threshold;
    if (!isStable) return { stable: null, commit: null, progress };

    const stable = { label: best.label, confidence: best.conf };
    let commit = null;
    if (stable.label !== this.lastCommitted || this.released) {
      commit = stable;
      this.lastCommitted = stable.label;
      this.released = false;
    }
    return { stable, commit, progress };
  }
}
