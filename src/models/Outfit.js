import mongoose from 'mongoose';

const outfitSchema = new mongoose.Schema({
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
  items: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClosetItem',
  }],
  shareId: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
  },
  isShared: {
    type: Boolean,
    default: false,
  },
  sharedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

outfitSchema.index({ user: 1, updatedAt: -1 });

export default mongoose.model('Outfit', outfitSchema);