import mongoose from 'mongoose';

const curatedCollectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  published: {
    type: Boolean,
    default: false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
}, {
  timestamps: true,
});

curatedCollectionSchema.index({ createdBy: 1, name: 1 }, { unique: true });

export default mongoose.model('CuratedCollection', curatedCollectionSchema);
