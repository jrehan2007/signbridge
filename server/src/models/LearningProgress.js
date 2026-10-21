import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

export const MASTERY_THRESHOLD = 0.85;

const learningProgressSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    signId: { type: ObjectId, ref: 'Sign', required: true },
    attempts: { type: Number, min: 0, default: 0 },
    bestAccuracy: { type: Number, min: 0, max: 1, default: 0 },
    status: { type: String, enum: ['new', 'learning', 'mastered'], default: 'new' },
    lastPracticedAt: { type: Date },
  },
  { timestamps: true }
);

// One progress document per learner per sign (resolves the users M:N signs relationship)
learningProgressSchema.index({ userId: 1, signId: 1 }, { unique: true });

export const LearningProgress = mongoose.model('LearningProgress', learningProgressSchema, 'learning_progress');
