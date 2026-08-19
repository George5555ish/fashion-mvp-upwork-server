import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ClosetItem from '../models/ClosetItem.js';
import CuratedLook from '../models/CuratedLook.js';
import Upload from '../models/Upload.js';
import { compressStoredImage } from '../utils/imageCompression.js';

dotenv.config();

const BATCH_SIZE = 25;
const DRY_RUN = process.argv.includes('--dry-run');

async function processCollection(Model, label) {
  const filter = { imageBase64: { $exists: true, $ne: '' } };
  const total = await Model.countDocuments(filter);

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let savedBytes = 0;

  console.log(`\n[${label}] ${total} documents with images`);

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

        if (!DRY_RUN) {
          doc.imageBase64 = compressed.base64;
          doc.imageMimeType = compressed.mimeType;
          await doc.save();
        }

        updated += 1;
      } catch (error) {
        failed += 1;
        console.error(`  [${label}] Failed ${doc._id}:`, error.message);
      }
    }

    console.log(`  [${label}] Progress: ${Math.min(skip + BATCH_SIZE, total)}/${total}`);
  }

  console.log(
    `[${label}] Done — updated: ${updated}, skipped: ${skipped}, failed: ${failed}, saved: ${Math.round(savedBytes / 1024)} KB`,
  );

  return { processed, updated, skipped, failed, savedBytes };
}

async function compressImages() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fashion-analyzer');
    console.log('✅ Connected to MongoDB');
    console.log(DRY_RUN ? '🔍 Dry run — no documents will be modified' : '🛠️  Compressing stored images');

    const results = [];
    results.push(await processCollection(ClosetItem, 'ClosetItem'));
    results.push(await processCollection(CuratedLook, 'CuratedLook'));
    results.push(await processCollection(Upload, 'Upload'));

    const totals = results.reduce(
      (acc, result) => ({
        updated: acc.updated + result.updated,
        skipped: acc.skipped + result.skipped,
        failed: acc.failed + result.failed,
        savedBytes: acc.savedBytes + result.savedBytes,
      }),
      { updated: 0, skipped: 0, failed: 0, savedBytes: 0 },
    );

    console.log('\n✅ Compression run complete');
    console.log(
      `   Updated: ${totals.updated}, skipped: ${totals.skipped}, failed: ${totals.failed}, total saved: ${Math.round(totals.savedBytes / 1024 / 1024 * 10) / 10} MB`,
    );

    if (DRY_RUN) {
      console.log('   Re-run without --dry-run to apply changes.');
    }

    await mongoose.disconnect();
    process.exit(totals.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Image compression error:', error);
    process.exit(1);
  }
}

compressImages();
