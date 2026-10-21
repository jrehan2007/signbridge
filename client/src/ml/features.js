/**
 * Landmark → feature-vector conversion.
 *
 * MUST stay identical to training/isl_features.py so that models trained offline
 * in Python and models trained in the browser accept the same input.
 *
 * Layout (126 floats):
 *   [0..62]   left-hand slot  : 21 landmarks × (x, y, z)
 *   [63..125] right-hand slot : 21 landmarks × (x, y, z)
 * Each hand is translated so the wrist (landmark 0) is the origin and scaled so the
 * farthest landmark from the wrist has length 1 → invariant to position, distance and hand size.
 * A missing hand is encoded as zeros.
 */
export const LANDMARKS_PER_HAND = 21;
export const VALUES_PER_HAND = LANDMARKS_PER_HAND * 3; // 63
export const FEATURE_SIZE = VALUES_PER_HAND * 2; // 126

/** @param {{x:number,y:number,z:number}[]} points */
export function normalizeHand(points) {
  const out = new Float32Array(VALUES_PER_HAND);
  if (!points || points.length !== LANDMARKS_PER_HAND) return out;
  const { x: wx, y: wy, z: wz } = points[0];
  let maxDist = 0;
  for (let i = 0; i < LANDMARKS_PER_HAND; i += 1) {
    const dx = points[i].x - wx;
    const dy = points[i].y - wy;
    const dz = (points[i].z ?? 0) - (wz ?? 0);
    out[i * 3] = dx;
    out[i * 3 + 1] = dy;
    out[i * 3 + 2] = dz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > maxDist) maxDist = d;
  }
  if (maxDist > 1e-6) for (let i = 0; i < VALUES_PER_HAND; i += 1) out[i] /= maxDist;
  return out;
}

/**
 * @param {Array<Array<{x,y,z}>>} landmarks  result.landmarks from MediaPipe HandLandmarker
 * @param {Array<Array<{categoryName:string,score:number}>>} handedness  result.handedness
 * @returns {Float32Array|null} 126-D vector, or null if no hand is present
 */
export function extractFeatures(landmarks, handedness = []) {
  if (!landmarks || landmarks.length === 0) return null;
  const vec = new Float32Array(FEATURE_SIZE);
  const used = [false, false];

  // Highest-confidence hands first, at most two
  const hands = landmarks
    .map((pts, i) => ({ pts, label: handedness?.[i]?.[0]?.categoryName, score: handedness?.[i]?.[0]?.score ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  for (const hand of hands) {
    let slot = hand.label === 'Right' ? 1 : 0;
    if (used[slot]) slot = 1 - slot; // two hands reported with the same label → use the free slot
    used[slot] = true;
    vec.set(normalizeHand(hand.pts), slot * VALUES_PER_HAND);
  }
  return vec;
}

/** Number of hands encoded in a feature vector (non-zero slots) */
export function handsInVector(vec) {
  let n = 0;
  for (let s = 0; s < 2; s += 1) {
    for (let i = s * VALUES_PER_HAND; i < (s + 1) * VALUES_PER_HAND; i += 1) {
      if (vec[i] !== 0) { n += 1; break; }
    }
  }
  return n;
}
