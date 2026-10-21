import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const translationLogSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    sessionId: { type: ObjectId, ref: 'Session' },
    signId: { type: ObjectId, ref: 'Sign' },
    recognizedText: { type: String, required: true, trim: true, maxlength: 120 },
    confidence: { type: Number, min: 0, max: 1, required: true },
    latencyMs: { type: Number, min: 0, default: 0 },
    spoken: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

translationLogSchema.index({ userId: 1, createdAt: -1 });
translationLogSchema.index({ signId: 1 });

export const TranslationLog = mongoose.model('TranslationLog', translationLogSchema, 'translation_logs');
