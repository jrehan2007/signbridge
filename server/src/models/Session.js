import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const sessionSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    modelVersionId: { type: ObjectId, ref: 'ModelVersion' },
    device: {
      browser: { type: String, maxlength: 200, default: '' },
      backend: { type: String, enum: ['webgl', 'wasm', 'cpu', 'webgpu', ''], default: '' },
      fps: { type: Number, min: 0, default: 0 },
    },
    startedAt: { type: Date, default: Date.now, required: true },
    endedAt: { type: Date, default: null },
    gestureCount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: false }
);

sessionSchema.index({ userId: 1, startedAt: -1 });

export const Session = mongoose.model('Session', sessionSchema, 'sessions');
