import User from '../models/userModel.js';
import FarmerProfile from '../models/farmerProfileModel.js';
import jwt from 'jsonwebtoken';
import { sendOTPEmail, sendPasswordResetEmail, send2FAEmail } from '../utils/sendEmail.js';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'techwiz_secret', {
    expiresIn: '30d',
  });
};

// Generate 6-digit random OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Register new user or re-register unverified user (Step 1: Send OTP)
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, phone, country, city, street } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please enter all required fields' });
    }

    let profileImageData = { url: '', public_id: '' };
    if (req.file) {
      profileImageData = {
        url: req.file.path,
        public_id: req.file.filename || req.file.public_id || '',
      };
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    let user = await User.findOne({ email });

    if (user) {
      // If user is already registered AND verified
      if (user.isVerified) {
        return res.status(400).json({ message: 'User with this email is already registered and verified' });
      }

      // If user is NOT verified, update their info and issue a fresh OTP (allow re-registration)
      user.name = name;
      user.password = password; // Will be hashed by pre-save hook upon save()
      user.role = role || 'user';
      if (phone) user.phone = phone;
      if (country || city || street) {
        user.address = {
          country: country || '',
          city: city || '',
          street: street || '',
        };
      }
      if (req.file) {
        user.profileImage = profileImageData;
      }
      user.otp = otp;
      user.otpExpires = otpExpires;

      await user.save();
    } else {
      // Create new user (unverified)
      user = await User.create({
        name,
        email,
        password,
        role: role || 'user',
        phone: phone || '',
        address: {
          country: country || '',
          city: city || '',
          street: street || '',
        },
        profileImage: profileImageData,
        isVerified: false,
        otp,
        otpExpires,
      });
    }

    // Send OTP to email
    await sendOTPEmail(email, otp);

    res.status(200).json({
      message: 'OTP sent to your email. Please verify to complete registration.',
      email: user.email,
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify OTP (Step 2: Complete Registration)
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Please provide email and OTP' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'User is already verified. Please login.' });
    }

    if (!user.otp || user.otp !== otp || !user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Mark user as verified and clear OTP fields
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;

    await user.save();

    // Auto-create initial FarmerProfile if role is farmer
    if (user.role === 'farmer') {
      const existingProfile = await FarmerProfile.findOne({ user: user._id });
      if (!existingProfile) {
        await FarmerProfile.create({
          user: user._id,
          farmName: `${user.name}'s Farm Stall`,
          contactPerson: user.name,
          email: user.email,
          phone: user.phone || '',
          description: 'Locally grown farm-fresh produce and organic harvest.',
          operatingDays: ['Saturday', 'Sunday'],
          pickupWindows: [
            { day: 'Saturday', startTime: '09:00 AM', endTime: '01:00 PM', cutoffHours: 2, maxOrders: 30 },
            { day: 'Sunday', startTime: '09:00 AM', endTime: '01:00 PM', cutoffHours: 2, maxOrders: 30 },
          ],
        });
      }
    }

    res.status(200).json({
      message: 'Email verified successfully! Registration complete.',
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Resend OTP to unverified user
// @route   POST /api/auth/resend-otp
// @access  Public
export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Please provide email' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found. Please register first.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'User is already verified. Please login.' });
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await user.save();

    await sendOTPEmail(email, otp);

    res.status(200).json({
      message: 'A fresh OTP has been sent to your email.',
      email: user.email,
    });
  } catch (error) {
    console.error('Resend OTP Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate user — Step 1: verify password, then send 2FA OTP
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please enter email and password' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (role && user.role !== role) {
      return res.status(401).json({ message: `Account does not match the selected ${role} role` });
    }

    if (!user.isVerified) {
      return res.status(401).json({
        message: 'Account not verified. Please verify the OTP sent to your email.',
        unverified: true,
        email: user.email,
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Password OK — generate & send 2FA OTP
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    await send2FAEmail(user.email, otp);

    return res.status(200).json({
      requires2FA: true,
      message: 'A 2FA verification code has been sent to your email.',
      email: user.email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Google OAuth login
// @route   POST /api/auth/google
// @access  Public
export const googleLogin = async (req, res) => {
  try {
    const { token, role } = req.body;
    let profile;

    // We use the access_token received from useGoogleLogin to fetch user info directly from Google
    try {
      const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      profile = response.data;
    } catch (err) {
      console.error('Error fetching google profile:', err.message);
      return res.status(400).json({ message: 'Invalid or expired Google Token' });
    }

    if (!profile.email) {
      return res.status(400).json({ message: 'No email found linked with this Google account' });
    }

    // Check if user exists
    let user = await User.findOne({ email: profile.email });

    if (user && role && user.role !== role) {
      return res.status(401).json({ message: `An account already exists with the ${user.role} role. You cannot login as a ${role}.` });
    }

    if (!user) {
      // Create new user if not exists
      const randomPassword = Math.random().toString(36).slice(-10) + 'A1!'; // strong random password
      
      user = await User.create({
        name: profile.name,
        email: profile.email,
        password: randomPassword,
        role: role || 'user',
        isVerified: true,
        profileImage: { url: profile.picture || '', public_id: '' }
      });

      // Auto-create Farmer profile if needed
      if (user.role === 'farmer') {
         await FarmerProfile.create({
           user: user._id,
           farmName: `${user.name}'s Farm Stall`,
           email: user.email,
           contactPerson: user.name,
           description: 'Locally grown farm-fresh produce and organic harvest.',
           operatingDays: ['Saturday', 'Sunday'],
           pickupWindows: [
             { day: 'Saturday', startTime: '09:00 AM', endTime: '01:00 PM', cutoffHours: 2, maxOrders: 30 }
           ]
         });
      }
    } else if (!user.isVerified) {
      // If user was unverified but logs in with Google, verify them
      user.isVerified = true;
      user.otp = undefined;
      user.otpExpires = undefined;
      await user.save();
    }

    res.status(200).json({
      message: 'Google login successful',
      token: generateToken(user._id),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage,
      },
    });

  } catch (error) {
    console.error('Google Login Error:', error);
    res.status(500).json({ message: 'Google authentication failed on server' });
  }
};

// @desc    Verify 2FA OTP — Step 2: return JWT token
// @route   POST /api/auth/verify-2fa
// @access  Public
export const verify2FA = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: 'Please provide email and OTP code' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.otp || user.otp !== otp.trim() || !user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired 2FA code' });
    }

    // Clear OTP fields after successful verification
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile image
export const updateProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image file' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.profileImage = {
      url: req.file.path,
      public_id: req.file.filename || req.file.public_id || '',
    };

    await user.save();

    res.json({
      message: 'Profile image updated successfully',
      profileImage: user.profileImage,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update customer profile details
// @route   PUT /api/auth/profile
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (req.body.name) user.name = req.body.name.trim();
    if (req.body.phone !== undefined) user.phone = req.body.phone.trim();
    if (req.body.address !== undefined) {
      user.address = {
        street: req.body.address.street || '',
        city: req.body.address.city || '',
        state: req.body.address.state || '',
        postalCode: req.body.address.postalCode || '',
      };
    }
    if (req.body.password && req.body.password.length >= 6) {
      user.password = req.body.password;
    }

    const updated = await user.save();
    res.json({
      _id: updated._id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      address: updated.address,
      role: updated.role,
      profileImage: updated.profileImage,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Forgot Password (Send OTP to registered email)
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Please provide your registered email' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ message: 'No account found with this email address. Please check the email and try again.' });
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    await sendPasswordResetEmail(user.email, otp);

    res.status(200).json({
      success: true,
      message: `Password reset OTP has been sent to ${user.email}. Please check your inbox and spam/junk folder.`,
      email: user.email,
    });
  } catch (error) {
    console.error('Forgot Password Error:', error.message);
    res.status(500).json({ message: error.message });
  }
};


// @desc    Reset Password using OTP
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Please provide email, OTP code, and new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.otp || user.otp !== otp.trim() || !user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired OTP code' });
    }

    // Set new password (will be hashed by user pre-save hook)
    user.password = newPassword;
    user.otp = undefined;
    user.otpExpires = undefined;

    // In case the user was unverified, resetting password via email OTP also verifies them
    user.isVerified = true;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully! You can now log in.',
    });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Save / Update user location coordinates
// @route   PUT /api/auth/location
// @access  Private
export const saveUserLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates' });
    }

    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({ success: false, message: 'Coordinates out of valid range' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.location = {
      lat: latNum,
      lng: lngNum,
      savedAt: new Date(),
    };

    await user.save();

    res.json({
      success: true,
      message: 'Location saved successfully',
      location: user.location,
    });
  } catch (error) {
    console.error('Save Location Error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

