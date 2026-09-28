import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import User from '../models/userModel.js';

dotenv.config();

const test = async () => {
  await connectDB();
  setTimeout(async () => {
    const admin = await User.findOne({ email: 'admin@gmail.com' });
    if (admin) {
      console.log('ADMIN FOUND IN DB:');
      console.log('Email:', admin.email);
      console.log('Role:', admin.role);
      console.log('isVerified:', admin.isVerified);
      const isMatch = await admin.matchPassword('admin123');
      console.log('Password Match test:', isMatch);
    } else {
      console.log('ADMIN NOT FOUND');
    }
    process.exit(0);
  }, 3000);
};

test();
