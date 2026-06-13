import Product from '../../models/Product.js';
import { getEbayConfig, isEbayConfigured } from './ebayConfig.js';
import { buildAffiliateUrl } from './ebayAffiliate.js';
import { buildEbaySearchQueries, normalizeCategory } from './ebayQueryBuilder.js';
import { ebayApiGet, resolveEbayShopUrl } from './ebayClient.js';
import { logEbay } from './ebayLogger.js';
import { filterMatchingEbayProducts } from './ebayResultValidator.js';

export const EBAY_RESULT_LIMIT = 3;

const PLACEHOLDER_IMAGE =
  'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg';

function getImageUrl(itemSummary) {
  return (
    itemSummary.image?.imageUrl ||
    itemSummary.thumbnailImages?.[0]?.imageUrl ||
    itemSummary.additionalImages?.[0]?.imageUrl ||
    PLACEHOLDER_IMAGE
  );
}

function mapItemToProductData(itemSummary, detectedItem, campaignId) {
  const shopUrl = resolveEbayShopUrl(itemSummary);
  if (!shopUrl) {
    return null;
  }

  const price = parseFloat(itemSummary.price?.value);
  if (Number.isNaN(price)) {
    return null;
  }

  const ebayItemId = itemSummary.itemId || itemSummary.legacyItemId;
  if (!ebayItemId) {
    return null;
  }

  const productId = `ebay:${ebayItemId}`;
  const imageUrl = getImageUrl(itemSummary);

  return {
    productId,
    name: itemSummary.title || 'eBay listing',
    category: normalizeCategory(detectedItem.category),
    brand: 'eBay',
    price,
    imageUrl,
    shopUrl: buildAffiliateUrl(shopUrl, campaignId),
    tags: ['ebay', detectedItem.category, detectedItem.color].filter(Boolean),
    description: itemSummary.title || '',
    color: detectedItem.color || '',
    style: detectedItem.style || '',
    source: 'ebay',
  };
}

async function searchEbay(query, limit) {
  const response = await ebayApiGet('/buy/browse/v1/item_summary/search', {
    q: query,
    limit: String(Math.min(limit, EBAY_RESULT_LIMIT)),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`eBay search failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const summaries = data.itemSummaries || [];
  logEbay('Search results', {
    query,
    total: data.total ?? summaries.length,
    returned: summaries.length,
  });
  return summaries;
}

function mapSummariesToProducts(summaries, detectedItem, campaignId, limit) {
  const mapped = summaries
    .map((item) => mapItemToProductData(item, detectedItem, campaignId))
    .filter(Boolean)
    .sort((a, b) => a.price - b.price);

  if (mapped.length < summaries.length) {
    logEbay('Some listings skipped', {
      returned: summaries.length,
      usable: mapped.length,
      reason: 'missing price or shop URL',
    });
  }

  return mapped.slice(0, limit);
}

/**
 * Search eBay and persist results as Product documents
 */
export async function findEbayProducts(detectedItem, limit = EBAY_RESULT_LIMIT) {
  if (!isEbayConfigured()) {
    return [];
  }

  const { campaignId } = getEbayConfig();
  const searchQueries = buildEbaySearchQueries(detectedItem);

  logEbay('Matching detected item', {
    category: detectedItem.category,
    color: detectedItem.color,
    description: detectedItem.description,
    searchQueries,
    limit,
  });

  let productDataList = [];

  for (const searchQuery of searchQueries) {
    const summaries = await searchEbay(searchQuery, limit);
    if (summaries.length === 0) {
      continue;
    }

    productDataList = mapSummariesToProducts(summaries, detectedItem, campaignId, limit);
    if (productDataList.length > 0) {
      logEbay('Using search query', { searchQuery, productCount: productDataList.length });
      break;
    }

    logEbay('Listings found but none usable — trying next query', {
      searchQuery,
      returned: summaries.length,
    });
  }

  if (productDataList.length === 0) {
    logEbay('No usable eBay listings for item', {
      category: detectedItem.category,
      triedQueries: searchQueries,
    });
    return [];
  }

  const validatedProductData = await filterMatchingEbayProducts(detectedItem, productDataList);
  if (validatedProductData.length === 0) {
    logEbay('No listings passed AI color/type validation', {
      category: detectedItem.category,
      color: detectedItem.color,
      candidateCount: productDataList.length,
    });
    return [];
  }

  const products = [];
  for (const productData of validatedProductData) {
    const product = await Product.findOneAndUpdate(
      { productId: productData.productId },
      { $set: productData },
      { upsert: true, new: true, runValidators: true }
    );
    products.push(product);
  }

  logEbay('Saved products for detected item', {
    count: products.length,
    source: 'ebay',
    items: products.map((p) => ({
      name: p.name,
      price: p.price,
      shopUrl: p.shopUrl,
    })),
  });

  return products;
}

/**
 * Fetch a single item by REST item ID (server-side only, uses auth)
 */
export async function getEbayItemById(itemId) {
  const encodedId = encodeURIComponent(itemId);
  const response = await ebayApiGet(`/buy/browse/v1/item/${encodedId}`);

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`eBay getItem failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}
