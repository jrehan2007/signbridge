import { FEATURE_SIZE } from './features.js';

/* ------------------------------------------------------------------ CSV (shared with training/*.py) */
export const CSV_HEADER = ['label', ...Array.from({ length: FEATURE_SIZE }, (_, i) => `f${i}`)].join(',');

const quote = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** @param {Record<string, number[][]>} samples  label → list of 126-D vectors */
export function toCSV(samples) {
  const lines = [CSV_HEADER];
  for (const [label, rows] of Object.entries(samples)) {
    for (const row of rows) lines.push(`${quote(label)},${Array.from(row, (v) => +v.toFixed(5)).join(',')}`);
  }
  return lines.join('\n');
}

function splitCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; } else if (ch === '"') q = false; else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** @returns {Record<string, number[][]>} */
export function fromCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return {};
  const start = lines[0].startsWith('label') ? 1 : 0;
  const samples = {};
  for (let i = start; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]);
    if (cells.length !== FEATURE_SIZE + 1) throw new Error(`Row ${i + 1}: expected ${FEATURE_SIZE + 1} columns, got ${cells.length}`);
    const values = cells.slice(1).map(Number);
    if (values.some((v) => !Number.isFinite(v))) throw new Error(`Row ${i + 1}: non-numeric value`);
    (samples[cells[0]] ||= []).push(values);
  }
  return samples;
}

/* ------------------------------------------------------------------ train / validation split */
/** Stratified shuffle split so every class appears in validation */
export function stratifiedSplit(samples, labels, valRatio = 0.2, seed = 42) {
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const train = []; const val = [];
  labels.forEach((label, classIdx) => {
    const rows = [...(samples[label] || [])];
    for (let i = rows.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }
    const nVal = rows.length >= 5 ? Math.max(1, Math.round(rows.length * valRatio)) : 0;
    rows.forEach((r, i) => (i < nVal ? val : train).push({ x: r, y: classIdx }));
  });
  for (let i = train.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [train[i], train[j]] = [train[j], train[i]]; }
  return { train, val };
}

/* ------------------------------------------------------------------ IndexedDB persistence (browser only) */
const DB_NAME = 'signbridge-studio';
const STORE = 'samples';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadSamples() {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get('all');
      req.onsuccess = () => resolve(req.result || {});
      req.onerror = () => reject(req.error);
    });
  } catch {
    return {};
  }
}

export async function saveSamples(samples) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(samples, 'all');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* private mode — samples stay in memory */ }
}
