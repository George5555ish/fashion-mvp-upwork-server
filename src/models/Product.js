import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['jacket', 'pants', 'shoes', 'shirt', 'dress', 'top', 'accessories', 'jeans', 'sneakers', 'boots', 'coat'],
    index: true,
  },
  brand: {
    type: String,
    default: 'OutFind',
  },
  price: {
    type: Number,
    required: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  shopUrl: {
    type: String,
    required: true,
  },
  tags: [{
    type: String,
    index: true,
  }],
  description: {
    type: String,
    default: '',
  },
  color: {
    type: String,
    index: true,
  },
  style: {
    type: String,
    default: '',
  },
  source: {
    type: String,
    enum: ['seed', 'ebay'],
    default: 'seed',
  },
}, {
  timestamps: true,
});

// Compound index for better search performance
productSchema.index({ category: 1, color: 1, tags: 1 });

export default mongoose.model('Product', productSchema);
