/**
 * Model file storage in MongoDB GridFS (bucket "model_files").
 *
 * Files are stored as "<version>/<name>" (e.g. "v1.0.0/model.json"). Keeping them in the database
 * instead of on disk means models survive restarts and work on serverless hosts such as Vercel,
 * where the filesystem is read-only and temporary.
 */
import mongoose from 'mongoose';

const BUCKET = 'model_files';
const bucket = () => {
  if (!mongoose.connection.db) throw new Error('Database is not connected');
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });
};

export const safeName = (name) => String(name).split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]/g, '_');
const key = (version, name) => `${version}/${safeName(name)}`;
const typeOf = (name) => (name.endsWith('.json') ? 'application/json' : 'application/octet-stream');

/** Save one file (Buffer). Replaces an existing file with the same name. */
export async function saveFile(version, name, buffer) {
  const b = bucket();
  const filename = key(version, name);
  for (const f of await b.find({ filename }).toArray()) await b.delete(f._id);
  await new Promise((resolve, reject) => {
    const up = b.openUploadStream(filename, { metadata: { version, contentType: typeOf(filename) } });
    up.once('finish', resolve);
    up.once('error', reject);
    up.end(buffer);
  });
}

/** Returns { stream, length, contentType } or null if the file does not exist. */
export async function openFile(version, name) {
  const b = bucket();
  const [file] = await b.find({ filename: key(version, name) }).limit(1).toArray();
  if (!file) return null;
  return { stream: b.openDownloadStream(file._id), length: file.length, contentType: file.metadata?.contentType || typeOf(file.filename) };
}

/** Read a whole file into a Buffer (null if missing). */
export async function readFile(version, name) {
  const f = await openFile(version, name);
  if (!f) return null;
  const chunks = [];
  for await (const c of f.stream) chunks.push(c);
  return Buffer.concat(chunks);
}

/** Names of the files stored for a version. */
export async function listFiles(version) {
  const files = await bucket().find({ 'metadata.version': version }).toArray();
  return files.map((f) => f.filename.slice(version.length + 1));
}

/** Delete every file of a version. */
export async function removeVersion(version) {
  const b = bucket();
  for (const f of await b.find({ 'metadata.version': version }).toArray()) await b.delete(f._id);
}
