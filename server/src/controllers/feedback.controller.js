import { Feedback, TranslationLog, Sign } from '../models/index.js';
import { ApiError, parsePaging, pageMeta } from '../utils/ApiError.js';

export const createFeedback = async (req, res) => {
  const { logId, expectedSignId, comment } = req.body;
  const log = await TranslationLog.findOne({ _id: logId, userId: req.user._id });
  if (!log) throw ApiError.notFound('Translation not found');
  if (expectedSignId && !(await Sign.exists({ _id: expectedSignId }))) throw ApiError.badRequest('Unknown sign');
  const feedback = await Feedback.create({ userId: req.user._id, logId, expectedSignId, comment });
  res.status(201).json({ success: true, feedback });
};

export const listMyFeedback = async (req, res) => {
  const items = await Feedback.find({ userId: req.user._id }).sort({ createdAt: -1 })
    .populate('expectedSignId', 'word').populate('logId', 'recognizedText confidence createdAt').lean();
  res.json({ success: true, items });
};

export const listAllFeedback = async (req, res) => {
  const paging = parsePaging(req.query);
  const filter = req.query.status ? { status: req.query.status } : {};
  const [items, total] = await Promise.all([
    Feedback.find(filter).sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit)
      .populate('userId', 'name email')
      .populate('expectedSignId', 'word')
      .populate('logId', 'recognizedText confidence createdAt')
      .lean(),
    Feedback.countDocuments(filter),
  ]);
  res.json({ success: true, items, meta: pageMeta(total, paging) });
};

export const updateFeedbackStatus = async (req, res) => {
  const feedback = await Feedback.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
  if (!feedback) throw ApiError.notFound('Feedback not found');
  res.json({ success: true, feedback });
};
