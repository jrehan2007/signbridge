// Usage: node src/seed/models-cli.js export|import
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/index.js';
import { env } from '../config/env.js';
import { exportSharedModels, importSharedModels } from './sharedModels.js';

const cmd = process.argv[2];
if (!['export', 'import'].includes(cmd)) {
  console.error('Usage: node src/seed/models-cli.js export|import');
  process.exit(1);
}

try {
  await connectDB();
  if (cmd === 'export') {
    await exportSharedModels();
  } else {
    const admin = await User.findOne({ email: env.admin.email }).select('_id').lean();
    await importSharedModels({ createdBy: admin?._id });
  }
  await disconnectDB();
  process.exit(0);
} catch (err) {
  console.error(`[models] ${cmd} failed:`, err.message);
  process.exit(1);
}
