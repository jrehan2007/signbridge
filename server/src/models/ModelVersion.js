import mongoose from 'mongoose';

const modelVersionSchema = new mongoose.Schema(
  {
    version: { type: String, required: true, unique: true, trim: true, match: /^v\d+\.\d+\.\d+$/ },
    modelUrl: { type: String, required: true },
    classLabels: { type: [String], required: true, validate: (v) => Array.isArray(v) && v.length >= 2 },
    numClasses: { type: Number, required: true, min: 2 },
    inputSize: { type: Number, default: 126 },
    valAccuracy: { type: Number, min: 0, max: 1, default: 0 },
    trainedSamples: { type: Number, min: 0, default: 0 },
    source: { type: String, enum: ['browser', 'python'], default: 'browser' },
    notes: { type: String, maxlength: 500, default: '' },
    isActive: { type: Boolean, default: false },
    releasedAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// At most one active model at a time
modelVersionSchema.index({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

export const ModelVersion = mongoose.model('ModelVersion', modelVersionSchema, 'model_versions');
