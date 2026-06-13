import OpenAI from 'openai';
import dotenv from 'dotenv';
import { logEbay, logEbayError } from './ebayLogger.js';

dotenv.config();

const PLACEHOLDER_IMAGE =
  'https://upload.wikimedia.org/wikipedia/commons/1/14/No_Image_Available.jpg';

const COLOR_WORDS = [
  'black', 'white', 'blue', 'navy', 'red', 'green', 'pink', 'yellow',
  'brown', 'beige', 'purple', 'orange', 'gray', 'grey', 'silver', 'gold',
  'cream', 'ivory', 'tan', 'maroon', 'teal', 'coral',
];

let openaiClient;

function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

function normalizeColorWord(color) {
  return (color || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function colorsAreCompatible(targetColor, listedColor) {
  const target = normalizeColorWord(targetColor);
  const listed = normalizeColorWord(listedColor);

  if (!target || !listed) {
    return true;
  }

  if (target === listed) {
    return true;
  }

  if ((target === 'gray' || target === 'grey') && (listed === 'gray' || listed === 'grey')) {
    return true;
  }

  if (listed.includes(target) || target.includes(listed)) {
    return true;
  }

  return false;
}

function titleConflictsWithTargetColor(title, targetColor) {
  const normalizedTarget = normalizeColorWord(targetColor);
  if (!normalizedTarget || !title) {
    return false;
  }

  const lowerTitle = title.toLowerCase();

  for (const colorWord of COLOR_WORDS) {
    if (!lowerTitle.includes(colorWord)) {
      continue;
    }

    if (!colorsAreCompatible(normalizedTarget, colorWord)) {
      return true;
    }
  }

  return false;
}

function filterByTitleColor(productDataList, detectedItem) {
  const filtered = productDataList.filter(
    (product) => !titleConflictsWithTargetColor(product.name, detectedItem.color)
  );

  if (filtered.length < productDataList.length) {
    logEbay('Filtered listings with conflicting title colors', {
      targetColor: detectedItem.color,
      before: productDataList.length,
      after: filtered.length,
      removed: productDataList
        .filter((product) => titleConflictsWithTargetColor(product.name, detectedItem.color))
        .map((product) => product.name),
    });
  }

  return filtered;
}

/**
 * Use vision to keep only eBay listings that match the detected item's type and color.
 * Returns an empty array when none pass or validation fails.
 */
export async function filterMatchingEbayProducts(detectedItem, productDataList) {
  if (!productDataList.length) {
    return [];
  }

  const titleFiltered = filterByTitleColor(productDataList, detectedItem);
  if (titleFiltered.length === 0) {
    logEbay('All listings rejected by title color filter', {
      targetColor: detectedItem.color,
      candidateCount: productDataList.length,
    });
    return [];
  }

  const candidates = titleFiltered
    .slice(0, 3)
    .filter((product) => product.imageUrl && product.imageUrl !== PLACEHOLDER_IMAGE);

  if (candidates.length === 0) {
    logEbay('No listing images available for AI validation');
    return [];
  }

  const content = [
    {
      type: 'text',
      text: `You are validating eBay search results for a fashion outfit matcher.

Target item from the user's uploaded photo:
- Clothing type: ${detectedItem.category}
- Primary color: ${detectedItem.color || 'unknown'}
- Description: ${detectedItem.description || detectedItem.style || 'none'}

For each listing image below, decide whether the product shown matches BOTH:
1. The same clothing type (e.g. dress, jacket, shoes — not a different garment)
2. The same primary color family (be strict: gray does not match blue, navy, black, white, etc.)

Use the listing title as a hint, but trust the image over the title when they conflict.

Return JSON only:
{
  "results": [
    { "index": 0, "matches": true, "reason": "brief reason" }
  ]
}

Use 0-based indexes matching the listing order below.`,
    },
  ];

  candidates.forEach((product, index) => {
    content.push({
      type: 'text',
      text: `Listing ${index}: "${product.name}"`,
    });
    content.push({
      type: 'image_url',
      image_url: { url: product.imageUrl },
    });
  });

  try {
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' },
      max_tokens: 600,
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      throw new Error('No response from OpenAI validation');
    }

    const parsed = JSON.parse(raw);
    const results = Array.isArray(parsed.results) ? parsed.results : [];

    const matching = candidates.filter((_, index) => {
      const result = results.find((entry) => entry.index === index);
      return result?.matches === true;
    });

    logEbay('AI validation complete', {
      category: detectedItem.category,
      color: detectedItem.color,
      candidates: candidates.length,
      passed: matching.length,
      results: results.map((entry) => ({
        index: entry.index,
        matches: entry.matches,
        reason: entry.reason,
      })),
    });

    return matching;
  } catch (error) {
    logEbayError('AI validation failed — returning no eBay matches', error);
    return [];
  }
}
