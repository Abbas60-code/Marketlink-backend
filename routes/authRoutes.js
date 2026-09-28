import express from 'express';
import {
  registerUser,
  verifyOTP,
  resendOTP,
  loginUser,
  verify2FA,
  forgotPassword,
  resetPassword,
  getUserProfile,
  updateUserProfile,
  updateProfileImage,
  googleLogin,
  saveUserLocation,
} from '../controllers/authController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Register user with optional profileImage file (Step 1: Sends OTP)
router.post('/register', upload.single('profileImage'), registerUser);

// Verify OTP (Step 2: Completes Registration)
router.post('/verify-otp', verifyOTP);

// Resend OTP
router.post('/resend-otp', resendOTP);

// Login user (Step 1: verify password, triggers 2FA OTP)
router.post('/login', loginUser);

// Verify 2FA OTP (Step 2: completes login, returns JWT)
router.post('/verify-2fa', verify2FA);

// Forgot password - sends OTP to email
router.post('/forgot-password', forgotPassword);

// Reset password - verifies OTP and sets new password
router.post('/reset-password', resetPassword);

// Get user profile (Protected)
router.get('/profile', protect, getUserProfile);

// Update user profile (Protected)
router.put('/profile', protect, updateUserProfile);

// Update user profile image (Protected)
router.put('/profile-image', protect, upload.single('profileImage'), updateProfileImage);

// Save / Update user location (Protected)
router.put('/location', protect, saveUserLocation);

// Google Sign-In
router.post('/google', googleLogin);

// Admin-only route example (Protected + Authorized Admin)
router.get('/admin-dashboard', protect, authorize('admin'), (req, res) => {
  res.json({
    message: 'Welcome to the Admin Dashboard!',
    admin: req.user,
  });
});

export default router;
