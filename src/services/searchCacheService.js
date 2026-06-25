import SearchCache from '../models/SearchCache.js';
import Product from '../models/Product.js';
import { buildEbaySearchQuery, normalizeCategory } from './ebay/ebayQueryBuilder.js';

const PLACEHOLDER_IMAGE =
  'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg';

const STOP_WORDS = new Set([
  'with', 'that', 'this', 'from', 'have', 'been', 'were', 'your', 'and', 'the',
  'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our',
  'out', 'featuring', 'includes', 'include', 'style', 'item', 'piece',
]);

function logSearchCache(message, details) {
  if (details !== undefined) {
    console.log('[SearchCache]', message, details);
    return;
  }
  console.log('[SearchCache]', message);
}

export function normalizeColor(color) {
  const value = (color || '').trim().toLowerCase();
  if (!value) {
    return '';
  }
  if (value === 'grey') {
    return 'gray';
  }
  return value;
}

export function extractKeywords(detectedItem) {
  const keywords = new Set();

  const addTerms = (text) => {
    if (!text) {
      return;
    }

    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length > 2 && !STOP_WORDS.has(term))
      .forEach((term) => keywords.add(term));
  };

  addTerms(detectedItem.style);
  addTerms(detectedItem.description);

  const category = normalizeCategory(detectedItem.category);
  if (category) {
    keywords.add(category);
  }

  const color = normalizeColor(detectedItem.color);
  if (color) {
    keywords.add(color);
  }

  return [...keywords].sort();
}

export function buildSearchTags(detectedItem) {
  return {
    category: normalizeCategory(detectedItem.category),
    color: normalizeColor(detectedItem.color),
    style: (detectedItem.style || '').trim().toLowerCase(),
    keywords: extractKeywords(detectedItem),
  };
}

export function buildCacheKey(detectedItem) {
  const tags = buildSearchTags(detectedItem);
  const keywordPart = tags.keywords.join('|');
  return `${tags.category}:${tags.color}:${keywordPart}`;
}

function tagsExactlyMatch(storedTags, queryTags) {
  if (storedTags.category !== queryTags.category) {
    return false;
  }

  if (storedTags.color !== queryTags.color) {
    return false;
  }

  if ((storedTags.style || '') !== (queryTags.style || '')) {
    return false;
  }

  const storedKeywords = [...(storedTags.keywords || [])].sort().join('|');
  const queryKeywords = [...(queryTags.keywords || [])].sort().join('|');

  return storedKeywords === queryKeywords;
}

function splitListingsBySource(listings) {
  const ebay = [];
  const shopping = [];

  for (const listing of listings) {
    if (listing.source === 'ebay') {
      ebay.push(listing);
    } else if (listing.source === 'shopping') {
      shopping.push(listing);
    }
  }

  return { ebay, shopping };
}

async function hydrateProductsFromListings(listings, detectedItem) {
  const tags = buildSearchTags(detectedItem);
  const products = [];

  for (const listing of listings) {
    const existing = await Product.findOne({ productId: listing.productId });
    const imageUrl =
      existing?.imageUrl && !existing.imageUrl.includes('No_Image_Available')
        ? existing.imageUrl
        : PLACEHOLDER_IMAGE;

    const product = await Product.findOneAndUpdate(
      { productId: listing.productId },
      {
        $set: {
          productId: listing.productId,
          name: listing.name,
          brand: listing.brand,
          price: listing.price,
          shopUrl: listing.shopUrl,
          imageUrl,
          category: tags.category,
          color: tags.color,
          style: tags.style,
          description: listing.name,
          source: listing.source,
          tags: [...tags.keywords, listing.source],
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
    products.push(product);
  }

  return products;
}

export async function findCachedProducts(detectedItem) {
  const tags = buildSearchTags(detectedItem);
  const cacheKey = buildCacheKey(detectedItem);

  const cacheEntry = await SearchCache.findOne({ cacheKey });

  if (!cacheEntry || cacheEntry.listings.length === 0) {
    logSearchCache('Cache miss', { cacheKey, tags });
    return null;
  }

  if (!tagsExactlyMatch(cacheEntry.tags, tags)) {
    logSearchCache('Cache miss — tags do not exactly match', {
      cacheKey,
      storedTags: cacheEntry.tags,
      queryTags: tags,
    });
    return null;
  }

  cacheEntry.hitCount += 1;
  cacheEntry.lastUsedAt = new Date();
  await cacheEntry.save();

  const products = await hydrateProductsFromListings(cacheEntry.listings, detectedItem);
  const { ebay, shopping } = splitListingsBySource(cacheEntry.listings);

  logSearchCache('Cache hit', {
    cacheKey: cacheEntry.cacheKey,
    listings: cacheEntry.listings.length,
    ebay: ebay.length,
    shopping: shopping.length,
    hitCount: cacheEntry.hitCount,
  });

  return {
    products,
    ebayProducts: products.filter((product) => product.source === 'ebay'),
    shoppingProducts: products.filter((product) => product.source === 'shopping'),
    ebayResultCount: ebay.length,
    shoppingResultCount: shopping.length,
    fromCache: true,
  };
}

export async function saveSearchCache(detectedItem, ebayProducts, shoppingProducts) {
  const retailerProducts = [...ebayProducts, ...shoppingProducts];
  if (retailerProducts.length === 0) {
    return null;
  }

  const tags = buildSearchTags(detectedItem);
  const cacheKey = buildCacheKey(detectedItem);
  const searchQuery = buildEbaySearchQuery(detectedItem);

  const listings = retailerProducts.map((product) => ({
    productId: product.productId,
    name: product.name,
    brand: product.brand,
    price: product.price,
    shopUrl: product.shopUrl,
    source: product.source,
  }));

  const cacheEntry = await SearchCache.findOneAndUpdate(
    { cacheKey },
    {
      $set: {
        cacheKey,
        tags,
        searchQuery,
        listings,
        ebayCount: ebayProducts.length,
        shoppingCount: shoppingProducts.length,
        lastUsedAt: new Date(),
      },
      $setOnInsert: {
        hitCount: 0,
      },
    },
    { upsert: true, new: true }
  );

  logSearchCache('Saved cache entry', {
    cacheKey,
    tags,
    listings: listings.length,
    ebay: ebayProducts.length,
    shopping: shoppingProducts.length,
  });

  return cacheEntry;
}
