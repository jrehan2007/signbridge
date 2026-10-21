import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { ModelVersion } from '../models/index.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const MODELS_DIR = path.join(env.uploadDir, 'models');

const safeName = (name) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');

/** Best-effort read of the output layer width from a TF.js layers-model topology */
const outputUnits = (modelJson) => {
  const topo = modelJson.modelTopology || {};
  const cfg = topo.model_config?.config || topo.config || {};
  const layers = cfg.layers || [];
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const units = layers[i]?.config?.units;
    if (Number.isInteger(units)) return units;
  }
  return null;
};

const nextVersion = async () => {
  const all = await ModelVersion.find().select('version').lean();
  let [maj, min, pat] = [1, 0, -1];
  for (const { version } of all) {
    const [a, b, c] = version.slice(1).split('.').map(Number);
    if (a > maj || (a === maj && b > min) || (a === maj && b === min && c > pat)) [maj, min, pat] = [a, b, c];
  }
  return `v${maj}.${min}.${pat + 1}`;
};

const removeTemp = (files = []) => Promise.all(files.map((f) => fs.rm(f.path, { force: true })));

export const getActiveModel = async (_req, res) => {
  const model = await ModelVersion.findOne({ isActive: true }).lean();
  res.json({ success: true, model: model || null });
};

export const listModels = async (_req, res) => {
  const items = await ModelVersion.find().sort({ releasedAt: -1 }).populate('createdBy', 'name').lean();
  res.json({ success: true, items });
};

/**
 * Multipart upload: files[] = model.json + weight shard(s); fields: classLabels (JSON array),
 * version?, valAccuracy?, trainedSamples?, notes?, source?, activate?
 */
export const uploadModel = async (req, res) => {
  const files = req.files || [];
  try {
    const modelFile = files.find((f) => safeName(f.originalname) === 'model.json');
    if (!modelFile) throw ApiError.badRequest('model.json is required');

    let modelJson;
    try { modelJson = JSON.parse(await fs.readFile(modelFile.path, 'utf8')); } catch {
      throw ApiError.badRequest('model.json is not valid JSON');
    }
    if (!modelJson.modelTopology || !Array.isArray(modelJson.weightsManifest)) {
      throw ApiError.badRequest('model.json must be a TensorFlow.js layers model (modelTopology + weightsManifest)');
    }

    const uploaded = new Set(files.map((f) => safeName(f.originalname)));
    const shardPaths = modelJson.weightsManifest.flatMap((g) => g.paths || []);
    const missing = shardPaths.filter((p) => !uploaded.has(safeName(p)));
    if (missing.length) throw ApiError.badRequest(`Missing weight files: ${missing.join(', ')}`);

    const { classLabels } = req.body;
    const units = outputUnits(modelJson);
    if (units && units !== classLabels.length) {
      throw ApiError.badRequest(`Model outputs ${units} classes but ${classLabels.length} labels were supplied`);
    }

    const version = req.body.version || (await nextVersion());
    if (await ModelVersion.exists({ version })) throw ApiError.conflict(`Version ${version} already exists`);

    const dir = path.join(MODELS_DIR, version);
    await fs.mkdir(dir, { recursive: true });
    // Rewrite manifest paths to their sanitised names so the browser can fetch them
    modelJson.weightsManifest.forEach((g) => { g.paths = g.paths.map(safeName); });
    await fs.writeFile(path.join(dir, 'model.json'), JSON.stringify(modelJson));
    for (const f of files) {
      const name = safeName(f.originalname);
      if (name !== 'model.json' && shardPaths.map(safeName).includes(name)) {
        await fs.copyFile(f.path, path.join(dir, name));
      }
    }

    const doc = await ModelVersion.create({
      version,
      modelUrl: `/uploads/models/${version}/model.json`,
      classLabels,
      numClasses: classLabels.length,
      valAccuracy: req.body.valAccuracy ?? 0,
      trainedSamples: req.body.trainedSamples ?? 0,
      source: req.body.source || 'browser',
      notes: req.body.notes || '',
      createdBy: req.user._id,
    });

    if (req.body.activate) await activate(doc._id);
    const fresh = await ModelVersion.findById(doc._id).lean();
    res.status(201).json({ success: true, model: fresh });
  } finally {
    await removeTemp(files);
  }
};

async function activate(id) {
  const session = await mongoose.startSession().catch(() => null);
  const run = async (opts = {}) => {
    await ModelVersion.updateMany({ isActive: true }, { isActive: false }, opts);
    await ModelVersion.updateOne({ _id: id }, { isActive: true }, opts);
  };
  // Use a transaction when the deployment supports it (replica set / Atlas); fall back otherwise
  if (session) {
    try {
      await session.withTransaction(() => run({ session }));
      return;
    } catch (err) {
      if (!/replica set|Transaction numbers/i.test(err.message)) throw err;
    } finally {
      await session.endSession();
    }
  }
  await run();
}

export const activateModel = async (req, res) => {
  if (!(await ModelVersion.exists({ _id: req.params.id }))) throw ApiError.notFound('Model not found');
  await activate(req.params.id);
  const model = await ModelVersion.findById(req.params.id).lean();
  res.json({ success: true, model });
};

export const deleteModel = async (req, res) => {
  const model = await ModelVersion.findById(req.params.id);
  if (!model) throw ApiError.notFound('Model not found');
  if (model.isActive) throw ApiError.badRequest('Activate another model before deleting the active one');
  await model.deleteOne();
  await fs.rm(path.join(MODELS_DIR, safeName(model.version)), { recursive: true, force: true });
  res.json({ success: true, message: `Model ${model.version} deleted` });
};
