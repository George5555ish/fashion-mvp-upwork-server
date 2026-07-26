import mongoose from 'mongoose';

const closetItemSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  color: {
    type: String,
    default: '',
    trim: true,
  },
  imageBase64: {
    type: String,
    required: true,
  },
  imageMimeType: {
    type: String,
    default: 'image/jpeg',
  },
}, {
  timestamps: true,
});

closetItemSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('ClosetItem', closetItemSchema);
