import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';

import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { serveModelFile } from './controllers/model.controller.js';
import { asyncHandler } from './utils/ApiError.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // CSP tuned for the Edge-AI client: WASM (MediaPipe), WebGL workers/blobs (TF.js),
  // the hand-landmarker model fallback on Google Storage, and Google Fonts.
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", "'wasm-unsafe-eval'"],
        'worker-src': ["'self'", 'blob:'],
        'connect-src': ["'self'", 'blob:', 'data:', 'https://storage.googleapis.com'],
        'img-src': ["'self'", 'data:', 'blob:'],
        'media-src': ["'self'", 'blob:', 'https:'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
      },
    },
  }));
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

  app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: env.isTest ? 10000 : 300, standardHeaders: 'draft-7', legacyHeaders: false }));

  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      status: 'ok',
      db: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown',
      uptime: Math.round(process.uptime()),
    });
  });

  // TF.js model files published by the model registry (stored in MongoDB GridFS)
  app.get('/uploads/models/:version/:file', asyncHandler(serveModelFile));

  app.use('/api', apiRoutes);

  // Serve the built React app in production (single deployable)
  const clientDist = path.resolve(env.uploadDir, '../../client/dist');
  if (env.isProd && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { maxAge: '1d', index: false }));
    // SPA fallback for client routes only — requests for missing files (e.g. /models/x.task) must 404
    app.get(/^\/(?!api\/|uploads\/)(?!.*\.[a-zA-Z0-9]+$).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
