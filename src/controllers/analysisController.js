import Upload from '../models/Upload.js';
import DetectedItem from '../models/DetectedItem.js';

/**
 * Get analysis results for an upload
 */
export async function getAnalysis(req, res) {
  try {
    const { uploadId } = req.params;

    // Find upload by uploadId (not _id)
    const upload = await Upload.findOne({ uploadId }).populate({
      path: 'detectedItems',
      populate: {
        path: 'matchedProducts',
        model: 'Product',
      },
    });

    if (!upload) {
      return res.status(404).json({ error: 'Upload not found' });
    }

    // Format response
    const response = {
      uploadId: upload.uploadId,
      status: upload.status,
      uploadDate: upload.uploadDate,
      imageBase64: upload.imageBase64,
      imageMimeType: upload.imageMimeType,
      detectedItems: upload.detectedItems.map(item => ({
        itemId: item.itemId,
        category: item.category,
        color: item.color,
        style: item.style,
        description: item.description,
        matchedProducts: item.matchedProducts || [],
      })),
      analysisResults: upload.analysisResults,
      error: upload.error,
    };

    res.json(response);
  } catch (error) {
    console.error('Get analysis error:', error);
    res.status(500).json({ error: 'Failed to get analysis: ' + error.message });
  }
}
