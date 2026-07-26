import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import uploadRoutes from './routes/upload.js';
import analysisRoutes from './routes/analysis.js';
import productRoutes from './routes/products.js';
import authRoutes from './routes/auth.js';
import albumRoutes from './routes/albums.js';
import lookRoutes from './routes/looks.js';
import collectionRoutes from './routes/collections.js';
import adminRoutes from './routes/admin.js';
import closetRoutes from './routes/closet.js';
import shareRoutes from './routes/share.js';
import ClosetItem from './models/ClosetItem.js';
import Outfit from './models/Outfit.js';
import { logEbayConfigStatus } from './services/ebay/ebayLogger.js';
import { logSerpApiConfigStatus } from './services/serpapi/serpapiLogger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api', (req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    console.log(
      `[OutFind] ${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - started}ms)`
    );
  });
  next();
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fashion-analyzer', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('✅ Connected to MongoDB');
  await Promise.all([
    ClosetItem.syncIndexes(),
    Outfit.syncIndexes(),
  ]);
  console.log('✅ Closet indexes synced');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/looks', lookRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/closet', closetRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/products', productRoutes);

app.get('/api/health', (req, res) => {
  const healthStatus = {
    status: 'ok',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  };

  const statusCode = healthStatus.database === 'connected' ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

// API 404 handler (must be before SPA fallback)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

if (!isProduction) {
  app.get('/', (req, res) => {
    res.json({
      message: 'Fashion Outfit Analyzer API',
      version: '1.0.0',
      endpoints: {
        health: '/api/health',
        auth: '/api/auth',
        albums: '/api/albums',
        looks: '/api/looks',
        admin: '/api/admin',
        closet: '/api/closet',
        upload: '/api/upload',
        analysis: '/api/analysis/:uploadId',
        products: '/api/products',
      },
    });
  });
}

// Serve frontend in production
if (isProduction) {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));

  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  logEbayConfigStatus();
  logSerpApiConfigStatus();
});
