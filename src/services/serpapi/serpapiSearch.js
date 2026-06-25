import Product from '../../models/Product.js';
import { normalizeCategory, buildEbaySearchQuery } from '../ebay/ebayQueryBuilder.js';
import { filterMatchingListingProducts } from '../ebay/ebayResultValidator.js';
import { getSerpApiConfig, isSerpApiConfigured } from './serpapiConfig.js';
import { logSerpApi, logSerpApiError } from './serpapiLogger.js';

export const SHOPPING_RESULT_LIMIT = 3;

const PLACEHOLDER_IMAGE =
  'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg';

function collectRawResults(data) {
  const results = [];

  if (Array.isArray(data.shopping_results)) {
    results.push(...data.shopping_results);
  }

  if (Array.isArray(data.inline_shopping_results)) {
    results.push(...data.inline_shopping_results);
  }

  if (Array.isArray(data.categorized_shopping_results)) {
    for (const group of data.categorized_shopping_results) {
      if (Array.isArray(group.shopping_results)) {
        results.push(...group.shopping_results);
      }
    }
  }

  const seen = new Set();
  return results.filter((item) => {
    const key = item.product_id || `${item.title}-${item.source}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getImageUrl(item) {
  return (
    item.serpapi_thumbnail ||
    item.thumbnail ||
    item.thumbnails?.[0] ||
    PLACEHOLDER_IMAGE
  );
}

function getShopUrl(item) {
  return item.link || item.product_link || '';
}

function mapItemToProductData(item, detectedItem) {
  const shopUrl = getShopUrl(item);
  const price = item.extracted_price;

  if (!shopUrl || price === undefined || Number.isNaN(Number(price))) {
    return null;
  }

  const productKey = item.product_id || `${item.title}-${item.source}`;
  const productId = `shopping:${productKey}`;
  const retailer = item.source?.trim() || 'Store';

  return {
    productId,
    name: item.title || 'Shopping result',
    category: normalizeCategory(detectedItem.category),
    brand: retailer,
    price: Number(price),
    imageUrl: getImageUrl(item),
    shopUrl,
    tags: ['shopping', detectedItem.category, detectedItem.color, retailer].filter(Boolean),
    description: item.title || '',
    color: detectedItem.color || '',
    style: detectedItem.style || '',
    source: 'shopping',
  };
}

async function searchGoogleShopping(query, limit) {
  const { apiKey, gl, hl, googleDomain } = getSerpApiConfig();
  const params = new URLSearchParams({
    engine: 'google_shopping',
    q: query,
    api_key: apiKey,
    gl,
    hl,
    google_domain: googleDomain,
    sort_by: '1',
  });

  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`SerpAPI search failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  const results = collectRawResults(data);
  logSerpApi('Search results', {
    query,
    total: results.length,
  });

  return results.slice(0, limit * 2);
}

function mapResultsToProducts(results, detectedItem, limit) {
  return results
    .map((item) => mapItemToProductData(item, detectedItem))
    .filter(Boolean)
    .sort((a, b) => a.price - b.price)
    .slice(0, limit);
}

async function persistProducts(productDataList) {
  const products = [];

  for (const productData of productDataList) {
    const product = await Product.findOneAndUpdate(
      { productId: productData.productId },
      { $set: productData },
      { upsert: true, new: true, runValidators: true }
    );
    products.push(product);
  }

  return products;
}

/**
 * Search Google Shopping via SerpAPI and persist results as Product documents.
 */
export async function findShoppingProducts(detectedItem, limit = SHOPPING_RESULT_LIMIT) {
  if (!isSerpApiConfigured()) {
    return [];
  }

  const query = buildEbaySearchQuery(detectedItem);

  logSerpApi('Matching detected item', {
    category: detectedItem.category,
    color: detectedItem.color,
    query,
    limit,
  });

  try {
    const rawResults = await searchGoogleShopping(query, limit);
    if (rawResults.length === 0) {
      logSerpApi('No Google Shopping results for item', {
        category: detectedItem.category,
        query,
      });
      return [];
    }

    const productDataList = mapResultsToProducts(rawResults, detectedItem, limit);
    if (productDataList.length === 0) {
      logSerpApi('Shopping results found but none usable', {
        returned: rawResults.length,
      });
      return [];
    }

    const validatedProductData = await filterMatchingListingProducts(detectedItem, productDataList);
    if (validatedProductData.length === 0) {
      logSerpApi('No listings passed AI color/type validation', {
        category: detectedItem.category,
        color: detectedItem.color,
        candidateCount: productDataList.length,
      });
      return [];
    }

    const products = await persistProducts(validatedProductData);

    logSerpApi('Saved products for detected item', {
      count: products.length,
      source: 'shopping',
      items: products.map((product) => ({
        name: product.name,
        price: product.price,
        brand: product.brand,
      })),
    });

    return products;
  } catch (error) {
    logSerpApiError('Search failed', error);
    return [];
  }
}
