const VALID_CATEGORIES = new Set([
  'jacket', 'pants', 'shoes', 'shirt', 'dress', 'top',
  'accessories', 'jeans', 'sneakers', 'boots', 'coat',
]);

const CATEGORY_ALIASES = {
  bag: 'accessories',
  bags: 'accessories',
  handbag: 'accessories',
  skirt: 'dress',
  shorts: 'pants',
  tshirt: 'shirt',
  tee: 'shirt',
  sweater: 'top',
  hoodie: 'top',
  blazer: 'jacket',
  coat: 'coat',
  footwear: 'shoes',
  trainers: 'sneakers',
};

/**
 * Normalize AI-detected category to Product schema enum
 */
export function normalizeCategory(category) {
  const value = (category || 'accessories').toLowerCase().trim();
  if (VALID_CATEGORIES.has(value)) {
    return value;
  }
  return CATEGORY_ALIASES[value] || 'accessories';
}

/**
 * Build eBay keyword search from detected clothing item
 */
export function buildEbaySearchQuery(detectedItem) {
  const { color, style, description, category } = detectedItem;
  const base = description?.trim() || style?.trim() || category?.trim() || 'clothing';
  const colorWord = color?.trim().toLowerCase();

  if (colorWord && !base.toLowerCase().includes(colorWord)) {
    return `${color.trim()} ${base}`.replace(/\s+/g, ' ').trim().slice(0, 100);
  }

  return base.replace(/\s+/g, ' ').trim().slice(0, 100);
}

/**
 * Ordered search queries — try specific first, then broader fallbacks
 */
export function buildEbaySearchQueries(detectedItem) {
  const primary = buildEbaySearchQuery(detectedItem);
  const category = normalizeCategory(detectedItem.category);
  const color = detectedItem.color?.trim().toLowerCase();

  const queries = [primary];
  if (color) {
    queries.push(`${color} ${category}`.replace(/\s+/g, ' ').trim());
    queries.push(`${color} ${category} women`.replace(/\s+/g, ' ').trim());
  }

  return [...new Set(queries.filter(Boolean))];
}
