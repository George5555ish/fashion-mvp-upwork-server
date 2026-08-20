import ClosetItem from '../models/ClosetItem.js';
import CuratedLook from '../models/CuratedLook.js';
import Upload from '../models/Upload.js';
import { compressStoredImage } from '../utils/imageCompression.js';

const BATCH_SIZE = 25;
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function processCollection(Model, label, { dryRun = false } = {}) {
  const filter = { imageBase64: { $exists: true, $ne: '' } };
  const total = await Model.countDocuments(filter);

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let savedBytes = 0;

  console.log(`[OutFind][${label}] Scanning ${total} documents with images`);

  for (let skip = 0; skip < total; skip += BATCH_SIZE) {
    const docs = await Model.find(filter)
      .select('_id imageBase64 imageMimeType')
      .skip(skip)
      .limit(BATCH_SIZE);

    for (const doc of docs) {
      processed += 1;

      try {
        const beforeBytes = Buffer.byteLength(doc.imageBase64, 'base64');
        const compressed = await compressStoredImage(doc.imageBase64, doc.imageMimeType);

        if (compressed.compressedBytes >= beforeBytes) {
          skipped += 1;
          continue;
        }

        savedBytes += beforeBytes - compressed.compressedBytes;

        if (!dryRun) {
          doc.imageBase64 = compressed.base64;
          doc.imageMimeType = compressed.mimeType;
          await doc.save();
        }

        updated += 1;
      } catch (error) {
        failed += 1;
        console.error(`[OutFind][${label}] Failed ${doc._id}:`, error.message);
      }
    }
  }

  console.log(
    `[OutFind][${label}] Done — updated: ${updated}, skipped: ${skipped}, failed: ${failed}, saved: ${Math.round(savedBytes / 1024)} KB`,
  );

  return { processed, updated, skipped, failed, savedBytes };
}

export async function runImageCompressionJob({ dryRun = false } = {}) {
  console.log(
    dryRun
      ? '[OutFind] Image compression dry run started'
      : '[OutFind] Image compression job started',
  );

  const results = [
    await processCollection(ClosetItem, 'ClosetItem', { dryRun }),
    await processCollection(CuratedLook, 'CuratedLook', { dryRun }),
    await processCollection(Upload, 'Upload', { dryRun }),
  ];

  const totals = results.reduce(
    (acc, result) => ({
      updated: acc.updated + result.updated,
      skipped: acc.skipped + result.skipped,
      failed: acc.failed + result.failed,
      savedBytes: acc.savedBytes + result.savedBytes,
    }),
    { updated: 0, skipped: 0, failed: 0, savedBytes: 0 },
  );

  console.log(
    `[OutFind] Image compression job complete — updated: ${totals.updated}, skipped: ${totals.skipped}, failed: ${totals.failed}, saved: ${Math.round((totals.savedBytes / 1024 / 1024) * 10) / 10} MB`,
  );

  return totals;
}

export function startImageCompressionScheduler() {
  const enabled = process.env.IMAGE_COMPRESSION_CRON_ENABLED !== 'false';
  if (!enabled) {
    console.log('[OutFind] Image compression cron disabled');
    return;
  }

  const intervalMs = Number(process.env.IMAGE_COMPRESSION_INTERVAL_MS) || DEFAULT_INTERVAL_MS;
  let running = false;

  const tick = async () => {
    if (running) {
      console.log('[OutFind] Image compression job already running — skipping this tick');
      return;
    }

    running = true;
    try {
      await runImageCompressionJob();
    } catch (error) {
      console.error('[OutFind] Image compression job failed:', error);
    } finally {
      running = false;
    }
  };

  const hours = Math.round(intervalMs / (60 * 60 * 1000) * 10) / 10;
  console.log(`[OutFind] Image compression cron scheduled every ${hours}h`);

  // Delay first run so startup / index sync isn't competing for CPU/memory
  setTimeout(() => {
    tick();
    setInterval(tick, intervalMs);
  }, 5 * 60 * 1000);
}
