import mongoose from 'mongoose';
import { seedAdmin } from '../utils/seedAdmin.js';

// Cache the connection promise across serverless invocations
let connectionPromise = null;

const connectDB = async () => {
  // If already connected, return immediately
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // If a connection is in progress, wait for it
  if (connectionPromise) {
    await connectionPromise;
    return;
  }

  const uri = process.env.Database || process.env.MONGO_URI;

  connectionPromise = mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  try {
    await connectionPromise;
    console.log('Database connected');
    await seedAdmin();
  } catch (error) {
    connectionPromise = null; // Reset so next request can retry
    console.error(`Database connection error: ${error.message}`);
    throw error; // Let the request fail with a proper error
  }
};

export default connectDB;
