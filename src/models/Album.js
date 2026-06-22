import mongoose from 'mongoose';

const albumItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  notes: {
    type: String,
    default: '',
  },
  savedFromUploadId: {
    type: String,
    default: '',
  },
  detectedCategory: {
    type: String,
    default: '',
  },
  detectedColor: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

const albumSchema = new mongoose.Schema({
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
  items: [albumItemSchema],
}, {
  timestamps: true,
});

albumSchema.index({ user: 1, name: 1 }, { unique: true });

export default mongoose.model('Album', albumSchema);
