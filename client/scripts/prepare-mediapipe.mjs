/**
 * Self-hosts the MediaPipe runtime so the app does not depend on a CDN at runtime:
 *   1. copies the WASM files shipped in node_modules → public/mediapipe/wasm
 *   2. downloads hand_landmarker.task → public/models (best effort; the app falls back to Google's URL)
 * Runs automatically before `npm run dev` and `npm run build`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wasmSrc = path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const wasmDst = path.join(root, 'public/mediapipe/wasm');
const modelDst = path.join(root, 'public/models/hand_landmarker.task');
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

await fs.mkdir(wasmDst, { recursive: true });
for (const f of await fs.readdir(wasmSrc)) await fs.copyFile(path.join(wasmSrc, f), path.join(wasmDst, f));
console.log('[mediapipe] WASM runtime copied to public/mediapipe/wasm');

try {
  await fs.access(modelDst);
  console.log('[mediapipe] hand_landmarker.task already present');
} catch {
  try {
    const res = await fetch(MODEL_URL, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await fs.mkdir(path.dirname(modelDst), { recursive: true });
    await fs.writeFile(modelDst, Buffer.from(await res.arrayBuffer()));
    console.log('[mediapipe] hand_landmarker.task downloaded to public/models');
  } catch (err) {
    console.warn(`[mediapipe] Could not download hand_landmarker.task (${err.message}); the browser will load it from Google at runtime.`);
  }
}
