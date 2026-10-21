// Vercel serverless entry: the whole Express API runs as one function.
// Routes stay identical to local dev (/api/*, /uploads/models/*) thanks to the rewrites in vercel.json.
import { createApp } from '../server/src/app.js';
import { connectDB } from '../server/src/config/db.js';

const app = createApp();

export default async function handler(req, res) {
  try {
    await connectDB();
  } catch (err) {
    console.error('[db] connection failed:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      message: 'Database unavailable — check MONGO_URI on Vercel and MongoDB Atlas → Network Access (allow 0.0.0.0/0).',
    }));
    return;
  }
  return app(req, res);
}
