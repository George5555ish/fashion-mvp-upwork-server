import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fashion-analyzer';

const connectionOptions = {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
};

export function isAtlasStaleAuthError(error) {
  if (!error) {
    return false;
  }

  const message = error.message || error.errmsg || '';
  return (
    error.code === 8000
    || error.codeName === 'AtlasError'
  ) && message.includes('cannot find user account after reload');
}

export async function connectDb() {
  await mongoose.connect(MONGODB_URI, connectionOptions);
  console.log('✅ Connected to MongoDB');
}

export async function reconnectDb() {
  console.warn('[OutFind] MongoDB stale connection detected — reconnecting...');
  await mongoose.disconnect();
  await mongoose.connect(MONGODB_URI, connectionOptions);
  console.log('[OutFind] MongoDB reconnected');
}

export async function withDbRetry(operation) {
  try {
    return await operation();
  } catch (error) {
    if (!isAtlasStaleAuthError(error)) {
      throw error;
    }

    await reconnectDb();
    return operation();
  }
}

export async function pingDb() {
  if (mongoose.connection.readyState !== 1) {
    return false;
  }

  try {
    await mongoose.connection.db.admin().ping();
    return true;
  } catch (error) {
    if (isAtlasStaleAuthError(error)) {
      await reconnectDb();
      await mongoose.connection.db.admin().ping();
      return true;
    }

    return false;
  }
}
