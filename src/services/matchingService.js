import Product from '../models/Product.js';

/**
 * Find similar products for a detected clothing item
 * @param {Object} detectedItem - The detected item with category, color, style, description
 * @param {number} limit - Maximum number of products to return
 * @returns {Promise<Array>} Array of similar products
 */
export async function findSimilarProducts(detectedItem, limit = 5) {
  try {
    const { category, color, style, description } = detectedItem;

    // Build search query
    let query = { category: category };

    // If color is specified, include it in the search
    if (color && color.trim() !== '') {
      query.$or = [
        { color: { $regex: color, $options: 'i' } },
        { tags: { $regex: color, $options: 'i' } }
      ];
    }

    // Also search by tags that might match style/description
    if (style || description) {
      const searchTerms = [style, description]
        .filter(term => term && term.trim() !== '')
        .map(term => term.toLowerCase().split(/\s+/))
        .flat()
        .filter(term => term.length > 3); // Filter out very short terms

      if (searchTerms.length > 0) {
        query.$or = query.$or || [];
        query.$or.push(
          ...searchTerms.map(term => ({ tags: { $regex: term, $options: 'i' } }))
        );
      }
    }

    // If no $or clause was added, remove it
    if (query.$or && query.$or.length === 0) {
      delete query.$or;
    }

    // If $or exists but color also exists, make it more flexible
    if (color && query.$or) {
      // Add exact color match as higher priority
      query = {
        category: category,
        $or: [
          { color: { $regex: color, $options: 'i' } },
          ...query.$or
        ]
      };
    }

    // Find products matching the criteria
    let products = await Product.find(query).limit(limit * 2);

    // If we don't have enough matches, fall back to category-only search
    if (products.length < limit) {
      const categoryOnlyProducts = await Product.find({ category: category })
        .limit(limit * 2);
      
      // Merge and deduplicate
      const existingIds = new Set(products.map(p => p._id.toString()));
      const additional = categoryOnlyProducts.filter(p => !existingIds.has(p._id.toString()));
      products = [...products, ...additional];
    }

    // Score and sort products
    products = products.map(product => ({
      product,
      score: calculateMatchScore(product, detectedItem)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.product);

    return products;
  } catch (error) {
    console.error('Error finding similar products:', error);
    // Fallback to simple category match
    try {
      const fallbackProducts = await Product.find({ category: detectedItem.category })
        .limit(limit);
      return fallbackProducts;
    } catch (fallbackError) {
      console.error('Fallback product search failed:', fallbackError);
      return [];
    }
  }
}

/**
 * Calculate match score for a product based on detected item
 * @param {Object} product - Product from database
 * @param {Object} detectedItem - Detected item
 * @returns {number} Match score (0-100)
 */
function calculateMatchScore(product, detectedItem) {
  let score = 50; // Base score for category match

  // Color match bonus (20 points)
  if (detectedItem.color && product.color) {
    const itemColor = detectedItem.color.toLowerCase();
    const productColor = product.color.toLowerCase();
    if (productColor.includes(itemColor) || itemColor.includes(productColor)) {
      score += 20;
    }
  }

  // Tag match bonus (15 points)
  if (detectedItem.style && product.tags) {
    const styleTerms = detectedItem.style.toLowerCase().split(/\s+/);
    const matchingTags = product.tags.filter(tag => 
      styleTerms.some(term => tag.toLowerCase().includes(term))
    );
    if (matchingTags.length > 0) {
      score += 15;
    }
  }

  // Description match bonus (15 points)
  if (detectedItem.description && product.description) {
    const descTerms = detectedItem.description.toLowerCase().split(/\s+/).slice(0, 5);
    const productDesc = product.description.toLowerCase();
    const matches = descTerms.filter(term => productDesc.includes(term));
    if (matches.length > 0) {
      score += 15;
    }
  }

  return Math.min(score, 100);
}
