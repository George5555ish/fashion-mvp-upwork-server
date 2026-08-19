import sharp from 'sharp';

const MAX_DIMENSION = Number(process.env.IMAGE_MAX_DIMENSION) || 1200;
const JPEG_QUALITY = Number(process.env.IMAGE_JPEG_QUALITY) || 80;

function estimateBase64Bytes(base64) {
  return Math.floor((base64.length * 3) / 4);
}

export async function compressImageBuffer(buffer, mimeType = 'image/jpeg') {
  const metadata = await sharp(buffer).metadata();
  const hasAlpha = metadata.hasAlpha || mimeType === 'image/png' || mimeType === 'image/webp';

  let pipeline = sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    });

  let outputBuffer;
  let outputMimeType;

  if (hasAlpha) {
    outputBuffer = await pipeline
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
    outputMimeType = 'image/png';
  } else {
    outputBuffer = await pipeline
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    outputMimeType = 'image/jpeg';
  }

  return {
    buffer: outputBuffer,
    mimeType: outputMimeType,
    base64: outputBuffer.toString('base64'),
    originalBytes: buffer.length,
    compressedBytes: outputBuffer.length,
  };
}

export async function compressUploadedFile(file) {
  const compressed = await compressImageBuffer(file.buffer, file.mimetype);

  console.log('[OutFind] Image compressed', {
    originalKb: Math.round(file.size / 1024),
    compressedKb: Math.round(compressed.compressedBytes / 1024),
    mimeType: compressed.mimeType,
  });

  return compressed;
}

export async function compressStoredImage(imageBase64, imageMimeType) {
  const input = Buffer.from(imageBase64, 'base64');
  const compressed = await compressImageBuffer(input, imageMimeType);

  return {
    ...compressed,
    originalStoredBytes: estimateBase64Bytes(imageBase64),
  };
}

export { MAX_DIMENSION, JPEG_QUALITY };
