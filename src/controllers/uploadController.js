import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import Upload from '../models/Upload.js';
import DetectedItem from '../models/DetectedItem.js';
import { analyzeOutfit, formatDetectedItems } from '../services/openaiService.js';
import { findSimilarProducts } from '../services/matchingService.js';
import { compressUploadedFile } from '../utils/imageCompression.js';

// Configure multer for memory storage (we'll convert to base64)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
}).single('image');

/**
 * Handle image upload and trigger OpenAI analysis
 */
export async function uploadImage(req, res, next) {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    try {
      const compressed = await compressUploadedFile(req.file);
      const uploadId = uuidv4();

      console.log('[OutFind] Upload received', {
        uploadId,
        mimeType: compressed.mimeType,
        sizeKb: Math.round(compressed.compressedBytes / 1024),
      });

      // Create upload record
      const uploadRecord = new Upload({
        uploadId,
        imageBase64: compressed.base64,
        imageMimeType: compressed.mimeType,
        status: 'processing',
      });

      await uploadRecord.save();

      // Start analysis asynchronously (don't wait for it)
      analyzeAndMatchProducts(uploadRecord._id, compressed.base64, compressed.mimeType)
        .catch(error => {
          console.error('Background analysis error:', error);
          Upload.findByIdAndUpdate(uploadRecord._id, {
            status: 'failed',
            error: error.message,
          }).catch(err => console.error('Failed to update upload status:', err));
        });

      res.json({
        uploadId,
        message: 'Image uploaded successfully. Analysis in progress.',
        status: 'processing',
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to process upload: ' + error.message });
    }
  });
}

/**
 * Analyze outfit and match products (async processing)
 */
async function analyzeAndMatchProducts(uploadId, base64Image, mimeType) {
  console.log('[OutFind] Starting analysis for upload:', uploadId.toString());

  try {
    const uploadRecord = await Upload.findById(uploadId);
    if (!uploadRecord) {
      throw new Error('Upload record not found');
    }

    // Call OpenAI Vision API
    const analysisResults = await analyzeOutfit(base64Image, mimeType);
    
    // Format detected items
    const formattedItems = formatDetectedItems(analysisResults.items || []);
    console.log('[OutFind] Analysis complete — detected items:', formattedItems.length);

    // Create DetectedItem records and find matching products
    const detectedItemIds = [];
    for (const item of formattedItems) {
      console.log('[OutFind] Matching products for:', {
        category: item.category,
        color: item.color,
        description: item.description,
      });

      const detectedItem = new DetectedItem({
        itemId: uuidv4(),
        uploadId: uploadRecord._id,
        ...item,
      });

      const { products, matchSource, ebayResultCount, shoppingResultCount, fromCache } = await findSimilarProducts(item, 5);
      console.log('[OutFind] Matched products:', products.length, 'for', item.category, '| source:', matchSource, '| ebay:', ebayResultCount, '| shopping:', shoppingResultCount, '| cache:', fromCache ? 'hit' : 'miss');
      detectedItem.matchedProducts = products.map(p => p._id);
      detectedItem.matchSource = matchSource;
      detectedItem.ebayResultCount = ebayResultCount;
      detectedItem.shoppingResultCount = shoppingResultCount;

      await detectedItem.save();
      detectedItemIds.push(detectedItem._id);
    }

    // Update upload record
    uploadRecord.analysisResults = analysisResults;
    uploadRecord.detectedItems = detectedItemIds;
    uploadRecord.status = 'completed';
    await uploadRecord.save();

    console.log('[OutFind] Upload analysis completed:', uploadId.toString());
    return { success: true };
  } catch (error) {
    console.error('Analysis error:', error);
    throw error;
  }
}
