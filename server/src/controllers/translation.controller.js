import mongoose from 'mongoose';
import { TranslationLog, Session, Sign, Feedback } from '../models/index.js';
import { ApiError, parsePaging, pageMeta } from '../utils/ApiError.js';

export const createLog = async (req, res) => {
  const { sessionId, signId, recognizedText, confidence, latencyMs, spoken } = req.body;

  if (sessionId) {
    const session = await Session.findOne({ _id: sessionId, userId: req.user._id });
    if (!session) throw ApiError.badRequest('Session does not belong to this user');
    if (session.endedAt) throw ApiError.badRequest('Session has already ended');
  }

  let resolvedSignId = signId;
  if (!resolvedSignId) {
    const sign = await Sign.findOne({ word: recognizedText }).select('_id').collation({ locale: 'en', strength: 2 }).lean();
    resolvedSignId = sign?._id;
  }

  const log = await TranslationLog.create({
    userId: req.user._id, sessionId, signId: resolvedSignId, recognizedText, confidence, latencyMs, spoken,
  });
  if (sessionId) await Session.updateOne({ _id: sessionId }, { $inc: { gestureCount: 1 } });

  res.status(201).json({ success: true, log });
};

export const listMyLogs = async (req, res) => {
  const paging = parsePaging(req.query);
  const filter = { userId: req.user._id };
  if (req.query.sessionId) filter.sessionId = req.query.sessionId;
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }

  const [items, total] = await Promise.all([
    TranslationLog.find(filter).sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit)
      .populate('signId', 'word category').lean(),
    TranslationLog.countDocuments(filter),
  ]);

  // Flag which logs already have feedback
  const fb = await Feedback.find({ logId: { $in: items.map((i) => i._id) } }).select('logId status').lean();
  const fbMap = new Map(fb.map((f) => [f.logId.toString(), f.status]));
  items.forEach((i) => { i.feedbackStatus = fbMap.get(i._id.toString()) || null; });

  res.json({ success: true, items, meta: pageMeta(total, paging) });
};

export const myStats = async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user._id);
  const [summary] = await TranslationLog.aggregate([
    { $match: { userId } },
    { $group: { _id: null, total: { $sum: 1 }, avgConfidence: { $avg: '$confidence' }, avgLatency: { $avg: '$latencyMs' } } },
  ]);
  const topSigns = await TranslationLog.aggregate([
    { $match: { userId } },
    { $group: { _id: '$recognizedText', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);
  const sessions = await Session.countDocuments({ userId });
  res.json({
    success: true,
    stats: {
      total: summary?.total || 0,
      avgConfidence: summary?.avgConfidence || 0,
      avgLatency: summary?.avgLatency || 0,
      sessions,
      topSigns: topSigns.map((t) => ({ word: t._id, count: t.count })),
    },
  });
};

export const deleteLog = async (req, res) => {
  const log = await TranslationLog.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!log) throw ApiError.notFound('Translation not found');
  await Feedback.deleteOne({ logId: log._id });
  res.json({ success: true, message: 'Translation deleted' });
};

export const clearMyLogs = async (req, res) => {
  const ids = await TranslationLog.find({ userId: req.user._id }).distinct('_id');
  await Promise.all([TranslationLog.deleteMany({ _id: { $in: ids } }), Feedback.deleteMany({ logId: { $in: ids } })]);
  res.json({ success: true, deleted: ids.length });
};
