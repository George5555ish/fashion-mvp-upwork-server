import mongoose from 'mongoose';

const detectedItemSchema = new mongoose.Schema({
  itemId: {
    type: String,
    required: true,
    unique: true,
  },
  uploadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Upload',
    required: true,
  },
  category: {
    type: String,
    required: true,
    index: true,
  },
  color: {
    type: String,
    default: '',
  },
  style: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    required: true,
  },
  matchedProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  }],
}, {
  timestamps: true,
});

export default mongoose.model('DetectedItem', detectedItemSchema);
