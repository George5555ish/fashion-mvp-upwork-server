import mongoose from 'mongoose';

const affiliateLinkSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    trim: true,
  },
  url: {
    type: String,
    required: true,
    trim: true,
  },
}, { _id: false });

const curatedLookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  caption: {
    type: String,
    default: '',
  },
  imageBase64: {
    type: String,
    required: true,
  },
  imageMimeType: {
    type: String,
    default: 'image/jpeg',
  },
  links: [affiliateLinkSchema],
  published: {
    type: Boolean,
    default: false,
  },
  collection: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CuratedCollection',
    default: null,
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

curatedLookSchema.index({ published: 1, createdAt: -1 });
curatedLookSchema.index({ published: 1, collection: 1, createdAt: -1 });
curatedLookSchema.index({ createdBy: 1, createdAt: -1 });

export default mongoose.model('CuratedLook', curatedLookSchema);
