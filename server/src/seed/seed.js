import { connectDB, disconnectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { User, Sign } from '../models/index.js';
import { SEED_SIGNS } from './signs.data.js';

export async function seed({ log = console.log } = {}) {
  // Make sure all declared indexes exist (unique email, unique word, compound progress index …)
  await Promise.all([User.syncIndexes(), Sign.syncIndexes()]);

  let admin = await User.findOne({ email: env.admin.email });
  if (!admin) {
    admin = new User({ name: env.admin.name, email: env.admin.email, role: 'admin' });
    await admin.setPassword(env.admin.password);
    await admin.save();
    log(`[seed] Admin created: ${env.admin.email} / ${env.admin.password}`);
  } else {
    log(`[seed] Admin exists: ${env.admin.email}`);
  }

  const ops = SEED_SIGNS.map((s) => ({
    updateOne: { filter: { word: s.word }, update: { $setOnInsert: { ...s, createdBy: admin._id } }, upsert: true },
  }));
  const result = await Sign.bulkWrite(ops);
  log(`[seed] Signs: ${result.upsertedCount} inserted, ${SEED_SIGNS.length - result.upsertedCount} already present`);
  return { admin };
}

const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isDirectRun) {
  connectDB()
    .then(() => seed())
    .then(() => disconnectDB())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] failed:', err);
      process.exit(1);
    });
}
