import { Sign, TranslationLog, LearningProgress } from '../models/index.js';
import { ApiError, parsePaging, pageMeta } from '../utils/ApiError.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const listSigns = async (req, res) => {
  const { q, category, handType, gestureType } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (handType) filter.handType = handType;
  if (gestureType) filter.gestureType = gestureType;
  if (q) filter.word = { $regex: escapeRegex(q), $options: 'i' };

  const paging = parsePaging(req.query, { defaultLimit: 100, maxLimit: 500 });
  const [items, total] = await Promise.all([
    Sign.find(filter).sort({ labelIndex: 1 }).skip(paging.skip).limit(paging.limit).lean(),
    Sign.countDocuments(filter),
  ]);
  res.json({ success: true, items, meta: pageMeta(total, paging) });
};

export const getSign = async (req, res) => {
  const sign = await Sign.findById(req.params.id).lean();
  if (!sign) throw ApiError.notFound('Sign not found');
  res.json({ success: true, sign });
};

export const createSign = async (req, res) => {
  const data = { ...req.body, createdBy: req.user._id };
  if (data.labelIndex === undefined) {
    const last = await Sign.findOne().sort({ labelIndex: -1 }).select('labelIndex').lean();
    data.labelIndex = last ? last.labelIndex + 1 : 0;
  }
  const sign = await Sign.create(data);
  res.status(201).json({ success: true, sign });
};

export const updateSign = async (req, res) => {
  const sign = await Sign.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!sign) throw ApiError.notFound('Sign not found');
  res.json({ success: true, sign });
};

export const deleteSign = async (req, res) => {
  const sign = await Sign.findByIdAndDelete(req.params.id);
  if (!sign) throw ApiError.notFound('Sign not found');
  // Keep history readable: detach logs, drop learner progress for the removed sign
  await Promise.all([
    TranslationLog.updateMany({ signId: sign._id }, { $unset: { signId: 1 } }),
    LearningProgress.deleteMany({ signId: sign._id }),
  ]);
  res.json({ success: true, message: `Sign "${sign.word}" deleted` });
};
