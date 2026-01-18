import Product from '../models/Product.js';
import { findSimilarProducts } from '../services/matchingService.js';

/**
 * Get all products
 */
export async function getProducts(req, res) {
  try {
    const { category, limit = 100 } = req.query;
    
    let query = {};
    if (category) {
      query.category = category;
    }

    const products = await Product.find(query).limit(parseInt(limit));
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to get products: ' + error.message });
  }
}

/**
 * Get similar products based on detected item criteria
 */
export async function getSimilarProducts(req, res) {
  try {
    const { category, color, style, description, limit = 5 } = req.query;

    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const detectedItem = {
      category,
      color: color || '',
      style: style || '',
      description: description || '',
    };

    const products = await findSimilarProducts(detectedItem, parseInt(limit));
    res.json(products);
  } catch (error) {
    console.error('Get similar products error:', error);
    res.status(500).json({ error: 'Failed to get similar products: ' + error.message });
  }
}

/**
 * Seed initial product data
 */
export async function seedProducts(req, res) {
  try {
    // Check if products already exist
    const existingCount = await Product.countDocuments();
    if (existingCount > 0) {
      return res.json({ 
        message: 'Products already seeded',
        count: existingCount 
      });
    }

    // Import seed data (we'll create this)
    const seedData = await import('../data/seedProducts.js');
    const products = seedData.default;

    // Insert products
    const inserted = await Product.insertMany(products);

    res.json({ 
      message: 'Products seeded successfully',
      count: inserted.length 
    });
  } catch (error) {
    console.error('Seed products error:', error);
    res.status(500).json({ error: 'Failed to seed products: ' + error.message });
  }
}
