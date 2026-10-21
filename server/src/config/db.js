import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

// Re-use one connection across serverless invocations (Vercel) and hot reloads
const cache = globalThis.__islMongo || (globalThis.__islMongo = { promise: null });

export async function connectDB(uri = env.mongoUri) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 10 })
      .then((conn) => {
        if (!env.isTest) console.log(`[db] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
        return conn.connection;
      })
      .catch((err) => { cache.promise = null; throw err; });
  }
  return cache.promise;
}

export async function disconnectDB() {
  cache.promise = null;
  await mongoose.connection.close();
}
