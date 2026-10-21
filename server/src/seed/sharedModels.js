/**
 * Portable models.
 *
 * Trained models live in MongoDB (model_versions + GridFS bucket model_files) — neither is part of the
 * source code, so they are lost when the project folder is shared. These helpers copy models to/from the
 * repository folder  shared-models/<version>/  (model.json, weight .bin files, meta.json), which IS shared.
 *
 *   npm run export-models   → DB            ➜  shared-models/
 *   npm run import-models   → shared-models/ ➜  DB             (also runs automatically during `npm run seed`)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ModelVersion } from '../models/index.js';
import { saveFile, readFile, listFiles } from '../storage/modelStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SHARED_DIR = path.resolve(__dirname, '../../../shared-models');
const VERSION_RX = /^v\d+\.\d+\.\d+$/;

const exists = (p) => fs.access(p).then(() => true, () => false);
const semver = (v) => v.slice(1).split('.').map(Number);
const cmpVersion = (a, b) => { const [x, y] = [semver(a), semver(b)]; return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };

const isModelFile = (f) => f === 'model.json' || f.endsWith('.bin');

/** shared-models/ ➜ MongoDB (metadata + GridFS files). Skips versions that already exist. */
export async function importSharedModels({ log = console.log, createdBy } = {}) {
  if (!(await exists(SHARED_DIR))) { log('[models] No shared-models/ folder — nothing to import'); return { imported: 0 }; }
  const entries = (await fs.readdir(SHARED_DIR, { withFileTypes: true })).filter((d) => d.isDirectory() && VERSION_RX.test(d.name));
  entries.sort((a, b) => cmpVersion(a.name, b.name));

  let imported = 0;
  let preferActive = null;
  for (const { name: version } of entries) {
    const dir = path.join(SHARED_DIR, version);
    const metaPath = path.join(dir, 'meta.json');
    if (!(await exists(metaPath)) || !(await exists(path.join(dir, 'model.json')))) {
      log(`[models] ${version}: skipped (needs model.json and meta.json)`); continue;
    }
    let meta;
    try { meta = JSON.parse(await fs.readFile(metaPath, 'utf8')); } catch { log(`[models] ${version}: meta.json is not valid JSON — skipped`); continue; }
    if (!Array.isArray(meta.classLabels) || meta.classLabels.length < 2) { log(`[models] ${version}: meta.json needs classLabels (2+) — skipped`); continue; }
    if (meta.isActive) preferActive = version;

    if (await ModelVersion.exists({ version })) { log(`[models] ${version}: already in database`); continue; }

    const modelJson = JSON.parse(await fs.readFile(path.join(dir, 'model.json'), 'utf8'));
    const needed = (modelJson.weightsManifest || []).flatMap((g) => g.paths || []);
    const missing = [];
    for (const p of needed) if (!(await exists(path.join(dir, p)))) missing.push(p);
    if (missing.length) { log(`[models] ${version}: missing weight files ${missing.join(', ')} — skipped`); continue; }

    for (const f of (await fs.readdir(dir)).filter(isModelFile)) await saveFile(version, f, await fs.readFile(path.join(dir, f)));
    await ModelVersion.create({
      version,
      modelUrl: `/uploads/models/${version}/model.json`,
      classLabels: meta.classLabels,
      numClasses: meta.classLabels.length,
      valAccuracy: meta.valAccuracy ?? 0,
      trainedSamples: meta.trainedSamples ?? 0,
      source: meta.source === 'python' ? 'python' : 'browser',
      notes: meta.notes ? `${meta.notes} (imported)` : 'Imported from shared-models/',
      isActive: false,
      releasedAt: meta.releasedAt ? new Date(meta.releasedAt) : new Date(),
      createdBy,
    });
    imported += 1;
    log(`[models] ${version}: imported (${meta.classLabels.length} signs: ${meta.classLabels.join(', ')})`);
  }

  // Make sure one model is active so the translator works straight away
  if (!(await ModelVersion.exists({ isActive: true }))) {
    const all = await ModelVersion.find().select('version').lean();
    const target = (preferActive && all.find((m) => m.version === preferActive)) || all.sort((a, b) => cmpVersion(b.version, a.version))[0];
    if (target) {
      await ModelVersion.updateOne({ _id: target._id }, { isActive: true });
      log(`[models] ${target.version} set as the active model`);
    }
  }
  return { imported };
}

/** MongoDB ➜ shared-models/ (overwrites existing copies of the same version). */
export async function exportSharedModels({ log = console.log } = {}) {
  const models = await ModelVersion.find().sort({ releasedAt: 1 }).lean();
  if (!models.length) { log('[models] No models in the database. Train and publish one in Admin → Model Studio first.'); return { exported: 0 }; }
  let exported = 0;
  for (const m of models) {
    const files = (await listFiles(m.version)).filter(isModelFile);
    if (!files.includes('model.json')) { log(`[models] ${m.version}: model files not found in the database — skipped`); continue; }
    const to = path.join(SHARED_DIR, m.version);
    await fs.mkdir(to, { recursive: true });
    for (const f of files) await fs.writeFile(path.join(to, f), await readFile(m.version, f));
    const meta = {
      version: m.version, classLabels: m.classLabels, valAccuracy: m.valAccuracy, trainedSamples: m.trainedSamples,
      source: m.source, notes: m.notes, isActive: m.isActive, releasedAt: m.releasedAt,
    };
    await fs.writeFile(path.join(to, 'meta.json'), JSON.stringify(meta, null, 2));
    exported += 1;
    log(`[models] ${m.version}${m.isActive ? ' (active)' : ''} → shared-models/${m.version}/  [${files.join(', ')}, meta.json]`);
  }
  log(`[models] Exported ${exported} model(s). Share the project folder (including shared-models/) and run "npm run seed" on the other computer.`);
  return { exported };
}

/**
 * One-time migration: models published by older versions of the app were stored on disk in
 * server/uploads/models/<version>/. Copy them into GridFS so they keep working.
 */
export async function migrateDiskModels({ log = console.log } = {}) {
  const { env } = await import('../config/env.js');
  const diskRoot = path.join(env.uploadDir, 'models');
  if (!(await exists(diskRoot))) return { migrated: 0 };
  let migrated = 0;
  for (const m of await ModelVersion.find().select('version').lean()) {
    const dir = path.join(diskRoot, m.version);
    if (!(await exists(path.join(dir, 'model.json')))) continue;
    if ((await listFiles(m.version)).includes('model.json')) continue;
    for (const f of (await fs.readdir(dir)).filter(isModelFile)) await saveFile(m.version, f, await fs.readFile(path.join(dir, f)));
    migrated += 1;
    log(`[models] ${m.version}: moved from server/uploads into the database`);
  }
  return { migrated };
}
