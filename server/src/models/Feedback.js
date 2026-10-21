import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const feedbackSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    logId: { type: ObjectId, ref: 'TranslationLog', required: true, unique: true }, // 1:1 with a translation log
    expectedSignId: { type: ObjectId, ref: 'Sign' },
    comment: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: ['open', 'reviewed', 'used'], default: 'open' },
  },
  { timestamps: true }
);

feedbackSchema.index({ status: 1, createdAt: -1 });

export const Feedback = mongoose.model('Feedback', feedbackSchema, 'feedback');
