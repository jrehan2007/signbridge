import mongoose from 'mongoose';

export const SIGN_CATEGORIES = ['alphabet', 'digit', 'word', 'phrase'];

const signSchema = new mongoose.Schema(
  {
    word: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    category: { type: String, enum: SIGN_CATEGORIES, required: true },
    handType: { type: String, enum: ['one', 'two'], default: 'one' },
    gestureType: { type: String, enum: ['static', 'dynamic'], default: 'static' },
    // Canonical class index of this sign in the dictionary (model_versions.classLabels holds the per-model order)
    labelIndex: { type: Number, required: true, unique: true, min: 0 },
    description: { type: String, trim: true, maxlength: 600, default: '' },
    howTo: { type: [String], default: [] },
    mediaUrl: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

signSchema.index({ word: 'text', description: 'text' });
signSchema.index({ category: 1, labelIndex: 1 });

export const Sign = mongoose.model('Sign', signSchema, 'signs');
