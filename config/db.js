import mongoose from 'mongoose';
import dns from 'dns';
import { seedAdmin } from '../utils/seedAdmin.js';

// Resolve DNS issues for mongodb+srv on Windows
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (err) {
  // Ignore if not supported
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.Database || process.env.MONGO_URI);
    console.log('Database connected');
    // Seed default admin account if not existing
    await seedAdmin();
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
  }
};

export default connectDB;
