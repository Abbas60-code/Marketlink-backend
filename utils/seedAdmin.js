import User from '../models/userModel.js';

export const seedAdmin = async () => {
  try {
    const adminEmail = 'muhammadabbas09dec@gmail.com';
    let admin = await User.findOne({ email: adminEmail });

    if (!admin) {
      await User.create({
        name: 'Muhammad Abbas',
        email: adminEmail,
        password: 'abbas123', // Will be hashed by pre-save hook in userModel
        role: 'user',
        isVerified: true, // Auto verified
      });
      console.log('Admin account ready as user.');
    } else {
      // Ensure existing account has user role and isVerified
      admin.role = 'user';
      admin.isVerified = true;
      admin.password = 'abbas123';
      await admin.save();
      console.log('Admin account verified as user.');
    }
  } catch (error) {
    console.error('Error seeding admin user:', error.message);
  }
};
