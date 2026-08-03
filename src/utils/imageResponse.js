const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function sendBase64Image(res, imageBase64, imageMimeType = 'image/jpeg') {
  const buffer = Buffer.from(imageBase64, 'base64');
  res.set({
    'Content-Type': imageMimeType,
    'Content-Length': buffer.length,
    'Cache-Control': `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
  });
  res.send(buffer);
}
