import mongoose from 'mongoose';

const uploadSchema = new mongoose.Schema({
  uploadId: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: String,
    default: null,
  },
  imageBase64: {
    type: String,
    required: true,
  },
  imageMimeType: {
    type: String,
    default: 'image/jpeg',
  },
  uploadDate: {
    type: Date,
    default: Date.now,
  },
  analysisResults: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  detectedItems: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DetectedItem',
  }],
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  error: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

export default mongoose.model('Upload', uploadSchema);
