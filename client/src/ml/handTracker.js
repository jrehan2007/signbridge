import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// WASM runtime is self-hosted (copied from node_modules by scripts/prepare-mediapipe.mjs)
const WASM_URL = `${import.meta.env.BASE_URL}mediapipe/wasm`;
// Prefer the self-hosted model file; fall back to Google's public bucket
const MODEL_URLS = [
  import.meta.env.VITE_HAND_MODEL_URL,
  `${import.meta.env.BASE_URL}models/hand_landmarker.task`,
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
].filter(Boolean);

export const HAND_CONNECTIONS = HandLandmarker.HAND_CONNECTIONS;

let instancePromise = null;
let delegateUsed = null;

async function create(fileset, modelAssetPath, delegate) {
  return HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath, delegate },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.5,
  });
}

async function createWithFallbacks() {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  let lastErr;
  for (const url of MODEL_URLS) {
    for (const delegate of ['GPU', 'CPU']) {
      try {
        const lm = await create(fileset, url, delegate);
        delegateUsed = delegate;
        return lm;
      } catch (err) {
        lastErr = err;
      }
    }
  }
  throw new Error(`Could not load the hand-tracking model (${lastErr?.message || 'unknown error'})`);
}

/** Lazily creates one shared HandLandmarker (self-hosted → remote model, GPU → CPU). */
export function getHandLandmarker() {
  if (!instancePromise) {
    instancePromise = createWithFallbacks().catch((err) => { instancePromise = null; throw err; });
  }
  return instancePromise;
}

export const getDelegate = () => delegateUsed;
