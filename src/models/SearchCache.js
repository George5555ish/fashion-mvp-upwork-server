import mongoose from 'mongoose';

const cachedListingSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  brand: {
    type: String,
    default: '',
  },
  price: {
    type: Number,
    required: true,
  },
  shopUrl: {
    type: String,
    required: true,
  },
  source: {
    type: String,
    enum: ['ebay', 'shopping'],
    required: true,
  },
}, { _id: false });

const searchCacheSchema = new mongoose.Schema({
  cacheKey: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  tags: {
    category: { type: String, required: true, index: true },
    color: { type: String, default: '', index: true },
    style: { type: String, default: '' },
    keywords: [{ type: String, index: true }],
  },
  searchQuery: {
    type: String,
    default: '',
  },
  listings: [cachedListingSchema],
  ebayCount: {
    type: Number,
    default: 0,
  },
  shoppingCount: {
    type: Number,
    default: 0,
  },
  hitCount: {
    type: Number,
    default: 0,
  },
  lastUsedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

searchCacheSchema.index({ 'tags.category': 1, 'tags.color': 1 });

export default mongoose.model('SearchCache', searchCacheSchema);
