import * as tf from '@tensorflow/tfjs';
import { FEATURE_SIZE } from './features.js';

let backendReady = null;

/** Initialise the fastest available TF.js backend (WebGL → WASM/CPU fallback). */
export function initTf() {
  if (!backendReady) {
    backendReady = (async () => {
      for (const b of ['webgl', 'cpu']) {
        try {
          if (await tf.setBackend(b)) { await tf.ready(); return tf.getBackend(); }
        } catch { /* try next */ }
      }
      await tf.ready();
      return tf.getBackend();
    })();
  }
  return backendReady;
}

/* ------------------------------------------------------------------ inference */
const cache = new Map(); // modelUrl → Promise<LayersModel>

export async function loadModel(modelUrl) {
  await initTf();
  if (!cache.has(modelUrl)) {
    const p = tf.loadLayersModel(modelUrl).then((m) => {
      // Warm-up so the first real prediction is not slow
      tf.tidy(() => m.predict(tf.zeros([1, FEATURE_SIZE])));
      return m;
    });
    p.catch(() => cache.delete(modelUrl));
    cache.set(modelUrl, p);
  }
  return cache.get(modelUrl);
}

/**
 * @returns {{label:string, index:number, confidence:number, probs:Float32Array, latencyMs:number}}
 */
export function predict(model, labels, features) {
  const t0 = performance.now();
  const probs = tf.tidy(() => model.predict(tf.tensor2d(features, [1, FEATURE_SIZE])).dataSync());
  let index = 0;
  for (let i = 1; i < probs.length; i += 1) if (probs[i] > probs[index]) index = i;
  return { label: labels[index], index, confidence: probs[index], probs, latencyMs: performance.now() - t0 };
}

/* ------------------------------------------------------------------ training (Model Studio) */
export function buildModel(numClasses) {
  const model = tf.sequential();
  model.add(tf.layers.dense({ inputShape: [FEATURE_SIZE], units: 128, activation: 'relu', kernelInitializer: 'heNormal' }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.dropout({ rate: 0.3 }));
  model.add(tf.layers.dense({ units: 64, activation: 'relu', kernelInitializer: 'heNormal' }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: numClasses, activation: 'softmax' }));
  model.compile({ optimizer: tf.train.adam(1e-3), loss: 'sparseCategoricalCrossentropy', metrics: ['accuracy'] });
  return model;
}

/** Light augmentation: small jitter + scale so the model generalises across signers */
function augment(rows, copies = 2, noise = 0.02) {
  const out = [];
  for (const { x, y } of rows) {
    out.push({ x, y });
    for (let c = 0; c < copies; c += 1) {
      const scale = 1 + (Math.random() - 0.5) * 0.1;
      out.push({ x: x.map((v) => (v === 0 ? 0 : v * scale + (Math.random() - 0.5) * 2 * noise)), y });
    }
  }
  return out;
}

/**
 * @param {{train:{x:number[],y:number}[], val:{x:number[],y:number}[]}} split
 * @param {number} numClasses
 * @param {{epochs?:number, batchSize?:number, onEpoch?:(epoch:number, logs:object)=>void}} opts
 */
export async function trainModel(split, numClasses, { epochs = 40, batchSize = 32, onEpoch } = {}) {
  await initTf();
  const model = buildModel(numClasses);
  const trainRows = augment(split.train);
  const xs = tf.tensor2d(trainRows.map((r) => r.x), [trainRows.length, FEATURE_SIZE]);
  const ys = tf.tensor1d(trainRows.map((r) => r.y), 'float32');
  const hasVal = split.val.length > 0;
  const vx = hasVal ? tf.tensor2d(split.val.map((r) => r.x), [split.val.length, FEATURE_SIZE]) : null;
  const vy = hasVal ? tf.tensor1d(split.val.map((r) => r.y), 'float32') : null;

  try {
    await model.fit(xs, ys, {
      epochs,
      batchSize,
      shuffle: true,
      validationData: hasVal ? [vx, vy] : undefined,
      // setTimeout instead of tf.nextFrame: requestAnimationFrame is paused in background tabs, which froze training
      callbacks: { onEpochEnd: async (epoch, logs) => { onEpoch?.(epoch, logs); await new Promise((r) => setTimeout(r, 0)); } },
    });

    // Final validation accuracy + per-class confusion
    let valAccuracy = 0;
    const confusion = Array.from({ length: numClasses }, () => new Array(numClasses).fill(0));
    if (hasVal) {
      const pred = tf.tidy(() => model.predict(vx).argMax(-1).dataSync());
      split.val.forEach((r, i) => { confusion[r.y][pred[i]] += 1; });
      valAccuracy = split.val.filter((r, i) => r.y === pred[i]).length / split.val.length;
    }
    return { model, valAccuracy, confusion };
  } finally {
    tf.dispose([xs, ys, vx, vy].filter(Boolean));
  }
}

/** Serialises a trained model to the files the API's model registry expects */
export async function modelToFiles(model) {
  let captured;
  await model.save(tf.io.withSaveHandler(async (artifacts) => { captured = artifacts; return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } }; }));
  const weightData = Array.isArray(captured.weightData)
    ? tf.io.concatenateArrayBuffers(captured.weightData)
    : captured.weightData;
  const modelJson = {
    format: 'layers-model',
    generatedBy: `TensorFlow.js tfjs-layers v${tf.version.tfjs}`,
    convertedBy: null,
    modelTopology: captured.modelTopology,
    weightsManifest: [{ paths: ['model.weights.bin'], weights: captured.weightSpecs }],
  };
  return [
    new File([JSON.stringify(modelJson)], 'model.json', { type: 'application/json' }),
    new File([weightData], 'model.weights.bin', { type: 'application/octet-stream' }),
  ];
}

export { tf };
