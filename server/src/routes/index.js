import { Router } from 'express';
import Joi from 'joi';
import multer from 'multer';
import rateLimit from 'express-rate-limit';

import { env } from '../config/env.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate, idParam, objectId } from '../middleware/validate.js';
import { asyncHandler as h } from '../utils/ApiError.js';
import { ROLES, LANGS, SIGN_CATEGORIES } from '../models/index.js';

import * as auth from '../controllers/auth.controller.js';
import * as signs from '../controllers/sign.controller.js';
import * as sessions from '../controllers/session.controller.js';
import * as translations from '../controllers/translation.controller.js';
import * as progress from '../controllers/progress.controller.js';
import * as feedback from '../controllers/feedback.controller.js';
import * as models from '../controllers/model.controller.js';
import * as admin from '../controllers/admin.controller.js';

const router = Router();
const adminOnly = [protect, authorize('admin')];
const paging = { page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(500) };

/* ---------------------------------------------------------------- Auth */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later' },
});
const password = Joi.string().min(8).max(72)
  .pattern(/[A-Za-z]/, 'letter').pattern(/\d/, 'number')
  .messages({ 'string.pattern.name': 'password must contain at least one {#name}' });

router.post('/auth/register', authLimiter, validate({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(80).required(),
    email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required(),
    password: password.required(),
    role: Joi.string().valid('user', 'learner').default('user'),
    preferredLang: Joi.string().valid(...LANGS).default('en'),
  }),
}), h(auth.register));

router.post('/auth/login', authLimiter, validate({
  body: Joi.object({ email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).required(), password: Joi.string().required() }),
}), h(auth.login));

router.get('/auth/me', protect, h(auth.me));
router.patch('/auth/me', protect, validate({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(80),
    preferredLang: Joi.string().valid(...LANGS),
    currentPassword: Joi.string(),
    newPassword: password,
  }).min(1),
}), h(auth.updateMe));

/* ---------------------------------------------------------------- Signs (dictionary) */
const signBody = {
  word: Joi.string().trim().min(1).max(60),
  category: Joi.string().valid(...SIGN_CATEGORIES),
  handType: Joi.string().valid('one', 'two'),
  gestureType: Joi.string().valid('static', 'dynamic'),
  labelIndex: Joi.number().integer().min(0),
  description: Joi.string().allow('').max(600),
  howTo: Joi.array().items(Joi.string().trim().max(200)).max(10),
  mediaUrl: Joi.string().allow('').uri({ allowRelative: true }).max(500),
};
router.get('/signs', validate({
  query: Joi.object({
    ...paging,
    q: Joi.string().trim().max(60).allow(''),
    category: Joi.string().valid(...SIGN_CATEGORIES),
    handType: Joi.string().valid('one', 'two'),
    gestureType: Joi.string().valid('static', 'dynamic'),
  }),
}), h(signs.listSigns));
router.get('/signs/:id', validate(idParam), h(signs.getSign));
router.post('/signs', adminOnly, validate({
  body: Joi.object({ ...signBody, word: signBody.word.required(), category: signBody.category.required() }),
}), h(signs.createSign));
router.patch('/signs/:id', adminOnly, validate({ ...idParam, body: Joi.object(signBody).min(1) }), h(signs.updateSign));
router.delete('/signs/:id', adminOnly, validate(idParam), h(signs.deleteSign));

/* ---------------------------------------------------------------- Sessions */
router.post('/sessions', protect, validate({
  body: Joi.object({
    modelVersionId: objectId(),
    device: Joi.object({
      browser: Joi.string().max(200).allow(''),
      backend: Joi.string().valid('webgl', 'wasm', 'cpu', 'webgpu', ''),
      fps: Joi.number().min(0).max(240),
    }).default({}),
  }),
}), h(sessions.startSession));
router.patch('/sessions/:id/end', protect, validate({ ...idParam, body: Joi.object({ fps: Joi.number().min(0).max(240) }) }),
  h(sessions.endSession));
router.get('/sessions/me', protect, validate({ query: Joi.object(paging) }), h(sessions.listMySessions));

/* ---------------------------------------------------------------- Translation logs */
router.post('/translations', protect, validate({
  body: Joi.object({
    sessionId: objectId(),
    signId: objectId(),
    recognizedText: Joi.string().trim().min(1).max(120).required(),
    confidence: Joi.number().min(0).max(1).required(),
    latencyMs: Joi.number().min(0).max(60000).default(0),
    spoken: Joi.boolean().default(false),
  }),
}), h(translations.createLog));
router.get('/translations/me', protect, validate({
  query: Joi.object({ ...paging, sessionId: objectId(), from: Joi.date().iso(), to: Joi.date().iso() }),
}), h(translations.listMyLogs));
router.get('/translations/me/stats', protect, h(translations.myStats));
router.delete('/translations/me', protect, h(translations.clearMyLogs));
router.delete('/translations/:id', protect, validate(idParam), h(translations.deleteLog));

/* ---------------------------------------------------------------- Learning progress */
router.get('/progress/me', protect, h(progress.myProgress));
router.post('/progress/attempt', protect, validate({
  body: Joi.object({ signId: objectId().required(), accuracy: Joi.number().min(0).max(1).required() }),
}), h(progress.recordAttempt));

/* ---------------------------------------------------------------- Feedback */
router.post('/feedback', protect, validate({
  body: Joi.object({
    logId: objectId().required(),
    expectedSignId: objectId(),
    comment: Joi.string().trim().allow('').max(500),
  }),
}), h(feedback.createFeedback));
router.get('/feedback/me', protect, h(feedback.listMyFeedback));
router.get('/feedback', adminOnly, validate({
  query: Joi.object({ ...paging, status: Joi.string().valid('open', 'reviewed', 'used') }),
}), h(feedback.listAllFeedback));
router.patch('/feedback/:id', adminOnly, validate({
  ...idParam, body: Joi.object({ status: Joi.string().valid('open', 'reviewed', 'used').required() }),
}), h(feedback.updateFeedbackStatus));

/* ---------------------------------------------------------------- Model registry */
// Files are kept in memory and written to GridFS (no local disk needed — works on Vercel).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => cb(null, /\.(json|bin)$/i.test(file.originalname)),
});
const labelsField = Joi.alternatives().try(
  Joi.array().items(Joi.string().trim().min(1).max(60)).min(2).unique(),
  Joi.string().custom((value, helpers) => {
    try {
      const arr = JSON.parse(value);
      const { error, value: v } = Joi.array().items(Joi.string().trim().min(1).max(60)).min(2).unique().validate(arr);
      return error ? helpers.message(`classLabels ${error.message}`) : v;
    } catch {
      return helpers.message('classLabels must be a JSON array of strings');
    }
  })
);

router.get('/models/active', h(models.getActiveModel));
router.get('/models', adminOnly, h(models.listModels));
router.post('/models', adminOnly, upload.array('files', 20), validate({
  body: Joi.object({
    classLabels: labelsField.required(),
    version: Joi.string().pattern(/^v\d+\.\d+\.\d+$/),
    valAccuracy: Joi.number().min(0).max(1),
    trainedSamples: Joi.number().integer().min(0),
    notes: Joi.string().allow('').max(500),
    source: Joi.string().valid('browser', 'python'),
    activate: Joi.boolean().truthy('true').falsy('false').default(false),
  }),
}), h(models.uploadModel));
router.patch('/models/:id/activate', adminOnly, validate(idParam), h(models.activateModel));
router.delete('/models/:id', adminOnly, validate(idParam), h(models.deleteModel));

/* ---------------------------------------------------------------- Admin */
router.get('/admin/overview', adminOnly, h(admin.overview));
router.get('/admin/users', adminOnly, validate({
  query: Joi.object({ ...paging, role: Joi.string().valid(...ROLES), q: Joi.string().trim().max(80).allow('') }),
}), h(admin.listUsers));
router.patch('/admin/users/:id', adminOnly, validate({
  ...idParam, body: Joi.object({ role: Joi.string().valid(...ROLES), isActive: Joi.boolean() }).min(1),
}), h(admin.updateUser));

export default router;
