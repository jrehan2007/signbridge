import { LearningProgress, Sign, MASTERY_THRESHOLD } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

export const myProgress = async (req, res) => {
  const items = await LearningProgress.find({ userId: req.user._id })
    .populate('signId', 'word category handType labelIndex').sort({ lastPracticedAt: -1 }).lean();
  const totalSigns = await Sign.estimatedDocumentCount();
  const mastered = items.filter((i) => i.status === 'mastered').length;
  res.json({
    success: true,
    items,
    summary: {
      totalSigns,
      practised: items.length,
      mastered,
      learning: items.filter((i) => i.status === 'learning').length,
      completion: totalSigns ? mastered / totalSigns : 0,
      masteryThreshold: MASTERY_THRESHOLD,
    },
  });
};

export const recordAttempt = async (req, res) => {
  const { signId, accuracy } = req.body;
  if (!(await Sign.exists({ _id: signId }))) throw ApiError.notFound('Sign not found');

  const existing = await LearningProgress.findOne({ userId: req.user._id, signId });
  const best = Math.max(existing?.bestAccuracy || 0, accuracy);
  const status = best >= MASTERY_THRESHOLD ? 'mastered' : 'learning';

  const progress = await LearningProgress.findOneAndUpdate(
    { userId: req.user._id, signId },
    { $inc: { attempts: 1 }, $set: { bestAccuracy: best, status, lastPracticedAt: new Date() } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).populate('signId', 'word category');

  res.json({ success: true, progress, improved: accuracy > (existing?.bestAccuracy || 0) });
};
