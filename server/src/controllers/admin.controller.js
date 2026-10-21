import { User, Sign, TranslationLog, Session, ModelVersion, Feedback, LearningProgress } from '../models/index.js';
import { ApiError, parsePaging, pageMeta } from '../utils/ApiError.js';

export const overview = async (_req, res) => {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - 6);

  const [users, signs, translations, sessions, models, openFeedback, mastered, activeModel, conf, daily, topSigns, lowConf] =
    await Promise.all([
      User.countDocuments(),
      Sign.countDocuments(),
      TranslationLog.countDocuments(),
      Session.countDocuments(),
      ModelVersion.countDocuments(),
      Feedback.countDocuments({ status: 'open' }),
      LearningProgress.countDocuments({ status: 'mastered' }),
      ModelVersion.findOne({ isActive: true }).select('version valAccuracy numClasses').lean(),
      TranslationLog.aggregate([{ $group: { _id: null, avg: { $avg: '$confidence' }, lat: { $avg: '$latencyMs' } } }]),
      TranslationLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      TranslationLog.aggregate([
        { $group: { _id: '$recognizedText', count: { $sum: 1 }, avgConfidence: { $avg: '$confidence' } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      TranslationLog.aggregate([
        { $group: { _id: '$recognizedText', avgConfidence: { $avg: '$confidence' }, count: { $sum: 1 } } },
        { $match: { count: { $gte: 3 } } },
        { $sort: { avgConfidence: 1 } },
        { $limit: 5 },
      ]),
    ]);

  // Fill the last 7 days so the chart has no gaps
  const byDay = new Map(daily.map((d) => [d._id, d.count]));
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    return { date: key, count: byDay.get(key) || 0 };
  });

  res.json({
    success: true,
    stats: {
      counts: { users, signs, translations, sessions, models, openFeedback, mastered },
      activeModel,
      avgConfidence: conf[0]?.avg || 0,
      avgLatency: conf[0]?.lat || 0,
      last7,
      topSigns: topSigns.map((t) => ({ word: t._id, count: t.count, avgConfidence: t.avgConfidence })),
      weakestSigns: lowConf.map((t) => ({ word: t._id, count: t.count, avgConfidence: t.avgConfidence })),
    },
  });
};

export const listUsers = async (req, res) => {
  const paging = parsePaging(req.query);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.q) {
    const rx = new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit).lean(),
    User.countDocuments(filter),
  ]);
  items.forEach((u) => delete u.passwordHash);
  res.json({ success: true, items, meta: pageMeta(total, paging) });
};

export const updateUser = async (req, res) => {
  if (req.params.id === req.user._id.toString() && (req.body.role && req.body.role !== 'admin' || req.body.isActive === false)) {
    throw ApiError.badRequest('You cannot demote or disable your own admin account');
  }
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!user) throw ApiError.notFound('User not found');
  res.json({ success: true, user });
};
