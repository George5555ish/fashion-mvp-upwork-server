import Product from '../models/Product.js';
import { isEbayConfigured } from './ebay/ebayConfig.js';
import { findEbayProducts, EBAY_RESULT_LIMIT } from './ebay/ebaySearch.js';
import { logEbayError } from './ebay/ebayLogger.js';
import { isSerpApiConfigured } from './serpapi/serpapiConfig.js';
import { findShoppingProducts, SHOPPING_RESULT_LIMIT } from './serpapi/serpapiSearch.js';
import { findCachedProducts, saveSearchCache } from './searchCacheService.js';

function resolveMatchSource(ebayProducts, shoppingProducts) {
  const hasEbay = ebayProducts.length > 0;
  const hasShopping = shoppingProducts.length > 0;

  if (hasEbay && hasShopping) {
    return 'mixed';
  }
  if (hasEbay) {
    return 'ebay';
  }
  if (hasShopping) {
    return 'shopping';
  }
  return 'seed';
}

/**
 * Find similar products for a detected clothing item.
 * Checks local search cache first, then eBay + Google Shopping in parallel.
 */
export async function findSimilarProducts(detectedItem, limit = 5) {
  const cached = await findCachedProducts(detectedItem);
  if (cached) {
    return {
      products: cached.products,
      matchSource: resolveMatchSource(cached.ebayProducts, cached.shoppingProducts),
      ebayResultCount: cached.ebayResultCount,
      shoppingResultCount: cached.shoppingResultCount,
      fromCache: true,
    };
  }

  let ebayResultCount = isEbayConfigured() ? 0 : null;
  let shoppingResultCount = isSerpApiConfigured() ? 0 : null;
  let ebayProducts = [];
  let shoppingProducts = [];

  const searchTasks = [];

  if (isEbayConfigured()) {
    searchTasks.push(
      findEbayProducts(detectedItem, EBAY_RESULT_LIMIT)
        .then((products) => {
          ebayProducts = products;
          ebayResultCount = products.length;
        })
        .catch((error) => {
          ebayResultCount = 0;
          logEbayError('Search failed', error);
        })
    );
  }

  if (isSerpApiConfigured()) {
    searchTasks.push(
      findShoppingProducts(detectedItem, SHOPPING_RESULT_LIMIT)
        .then((products) => {
          shoppingProducts = products;
          shoppingResultCount = products.length;
        })
        .catch((error) => {
          shoppingResultCount = 0;
          console.error('[SerpAPI] Search failed', error);
        })
    );
  }

  if (searchTasks.length > 0) {
    await Promise.all(searchTasks);
  }

  const retailerProducts = [...ebayProducts, ...shoppingProducts];

  if (retailerProducts.length > 0) {
    await saveSearchCache(detectedItem, ebayProducts, shoppingProducts);

    console.log('[OutFind] Retailer matches for', detectedItem.category, {
      ebay: ebayProducts.length,
      shopping: shoppingProducts.length,
      matchSource: resolveMatchSource(ebayProducts, shoppingProducts),
      fromCache: false,
    });

    return {
      products: retailerProducts,
      matchSource: resolveMatchSource(ebayProducts, shoppingProducts),
      ebayResultCount,
      shoppingResultCount,
      fromCache: false,
    };
  }

  if (isEbayConfigured() || isSerpApiConfigured()) {
    console.log('[OutFind] No retailer matches — using seed DB for', detectedItem.category);
  } else {
    console.log('[OutFind] No retailer APIs configured — using seed DB for', detectedItem.category);
  }

  const products = await findSeedProducts(detectedItem, limit);
  return {
    products,
    matchSource: 'seed',
    ebayResultCount,
    shoppingResultCount,
    fromCache: false,
  };
}

async function findSeedProducts(detectedItem, limit = 5) {
  console.log('[OutFind] Using seed DB for', detectedItem.category);
  try {
    const { category, color, style, description } = detectedItem;

    let query = { category: category };

    if (color && color.trim() !== '') {
      query.$or = [
        { color: { $regex: color, $options: 'i' } },
        { tags: { $regex: color, $options: 'i' } }
      ];
    }

    if (style || description) {
      const searchTerms = [style, description]
        .filter(term => term && term.trim() !== '')
        .map(term => term.toLowerCase().split(/\s+/))
        .flat()
        .filter(term => term.length > 3);

      if (searchTerms.length > 0) {
        query.$or = query.$or || [];
        query.$or.push(
          ...searchTerms.map(term => ({ tags: { $regex: term, $options: 'i' } }))
        );
      }
    }

    if (query.$or && query.$or.length === 0) {
      delete query.$or;
    }

    if (color && query.$or) {
      query = {
        category: category,
        $or: [
          { color: { $regex: color, $options: 'i' } },
          ...query.$or
        ]
      };
    }

    let products = await Product.find(query).limit(limit * 2);

    if (products.length < limit) {
      const categoryOnlyProducts = await Product.find({ category: category })
        .limit(limit * 2);

      const existingIds = new Set(products.map(p => p._id.toString()));
      const additional = categoryOnlyProducts.filter(p => !existingIds.has(p._id.toString()));
      products = [...products, ...additional];
    }

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

function calculateMatchScore(product, detectedItem) {
  let score = 50;

  if (detectedItem.color && product.color) {
    const itemColor = detectedItem.color.toLowerCase();
    const productColor = product.color.toLowerCase();
    if (productColor.includes(itemColor) || itemColor.includes(productColor)) {
      score += 20;
    }
  }

  if (detectedItem.style && product.tags) {
    const styleTerms = detectedItem.style.toLowerCase().split(/\s+/);
    const matchingTags = product.tags.filter(tag =>
      styleTerms.some(term => tag.toLowerCase().includes(term))
    );
    if (matchingTags.length > 0) {
      score += 15;
    }
  }

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
