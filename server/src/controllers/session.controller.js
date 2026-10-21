import { Session, ModelVersion } from '../models/index.js';
import { ApiError, parsePaging, pageMeta } from '../utils/ApiError.js';

export const startSession = async (req, res) => {
  const { modelVersionId, device } = req.body;
  if (modelVersionId && !(await ModelVersion.exists({ _id: modelVersionId }))) {
    throw ApiError.badRequest('Unknown model version');
  }
  const session = await Session.create({ userId: req.user._id, modelVersionId, device });
  res.status(201).json({ success: true, session });
};

export const endSession = async (req, res) => {
  const session = await Session.findOne({ _id: req.params.id, userId: req.user._id });
  if (!session) throw ApiError.notFound('Session not found');
  if (!session.endedAt) session.endedAt = new Date();
  if (req.body.fps !== undefined) session.device.fps = req.body.fps;
  await session.save();
  res.json({ success: true, session });
};

export const listMySessions = async (req, res) => {
  const paging = parsePaging(req.query);
  const filter = { userId: req.user._id };
  const [items, total] = await Promise.all([
    Session.find(filter).sort({ startedAt: -1 }).skip(paging.skip).limit(paging.limit)
      .populate('modelVersionId', 'version').lean(),
    Session.countDocuments(filter),
  ]);
  res.json({ success: true, items, meta: pageMeta(total, paging) });
};
