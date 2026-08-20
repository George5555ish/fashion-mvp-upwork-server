import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { runImageCompressionJob } from '../services/imageCompressionJob.js';

dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');

async function compressImages() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fashion-analyzer');
    console.log('✅ Connected to MongoDB');

    const totals = await runImageCompressionJob({ dryRun: DRY_RUN });

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
