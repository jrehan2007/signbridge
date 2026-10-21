import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const required = (key, fallback) => {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const nodeEnv = process.env.NODE_ENV || 'development';

export const env = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT || 5050),
  clientOrigin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  mongoUri: required('MONGO_URI', 'mongodb://127.0.0.1:27017/isl_translator'),
  jwtSecret: required('JWT_SECRET', nodeEnv === 'production' ? undefined : 'dev-only-insecure-secret'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  uploadDir: path.resolve(__dirname, '../../uploads'),
  admin: {
    name: process.env.ADMIN_NAME || 'Portal Admin',
    email: process.env.ADMIN_EMAIL || 'admin@isl.local',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
  },
};
