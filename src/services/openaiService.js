import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyze an outfit image using OpenAI Vision API
 * @param {string} base64Image - Base64 encoded image
 * @param {string} mimeType - Image MIME type (e.g., 'image/jpeg')
 * @returns {Promise<Object>} Analysis results with detected clothing items
 */
export async function analyzeOutfit(base64Image, mimeType = 'image/jpeg') {
  try {
    const prompt = `Analyze this outfit photo and identify all visible clothing items and accessories. 
    For each item, return a JSON object with a "items" array. Each item in the array should have:
    - category (e.g., 'jacket', 'pants', 'shoes', 'shirt', 'dress', 'top', 'jeans', 'sneakers', 'boots', 'coat')
    - color (primary color of the item)
    - style (brief style description)
    - description (detailed description of the item)
    
    Focus on main clothing pieces that are clearly visible. Be specific about colors, patterns, and styles.
    Return only valid JSON without markdown formatting.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: prompt 
            },
            { 
              type: "image_url", 
              image_url: { 
                url: `data:${mimeType};base64,${base64Image}` 
              } 
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response
    const parsed = JSON.parse(content);
    
    // Ensure items array exists
    if (!parsed.items || !Array.isArray(parsed.items)) {
      return { items: [] };
    }

    return parsed;
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error(`Failed to analyze outfit: ${error.message}`);
  }
}

/**
 * Format detected items for database storage
 * @param {Array} items - Array of detected items from OpenAI
 * @returns {Array} Formatted items
 */
export function formatDetectedItems(items) {
  return items.map((item, index) => ({
    category: item.category?.toLowerCase() || 'unknown',
    color: item.color?.toLowerCase() || '',
    style: item.style || '',
    description: item.description || `${item.category} in ${item.color}`,
  }));
}
