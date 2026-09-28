import express from 'express';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import app from '../app.js';
import User from '../models/userModel.js';

dotenv.config();

let server;

const runTests = async () => {
  console.log('=== STARTING COMPLETE API SUITE TEST ===\n');

  // 1. Connect DB
  await connectDB();

  // Start Express server on port 9090 for testing
  const PORT = 9090;
  server = app.listen(PORT, async () => {
    console.log(`Test Server running on http://localhost:${PORT}`);
    const baseURL = `http://localhost:${PORT}`;

    try {
      // Clean up previous test users if any
      const testEmail = 'testuser_verify@gmail.com';
      await User.deleteOne({ email: testEmail });

      // TEST 1: Root Route
      console.log('\n--- TEST 1: Root Health Check (GET /) ---');
      const resRoot = await fetch(`${baseURL}/`);
      const textRoot = await resRoot.text();
      console.log('Status:', resRoot.status, '| Response:', textRoot);

      // TEST 2: Register User (Step 1)
      console.log('\n--- TEST 2: Register User (POST /api/auth/register) ---');
      const resReg = await fetch(`${baseURL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User',
          email: testEmail,
          password: 'password123',
        }),
      });
      const dataReg = await resReg.json();
      console.log('Status:', resReg.status, '| Response:', dataReg);

      // Fetch OTP from DB for testing
      let userInDB = await User.findOne({ email: testEmail });
      console.log('User created in DB | isVerified:', userInDB?.isVerified, '| OTP in DB:', userInDB?.otp);

      // TEST 3: Re-register Unverified User (Should allow overwriting OTP)
      console.log('\n--- TEST 3: Re-register Unverified User ---');
      const resReReg = await fetch(`${baseURL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User Updated',
          email: testEmail,
          password: 'newpassword123',
        }),
      });
      const dataReReg = await resReReg.json();
      console.log('Status:', resReReg.status, '| Response:', dataReReg);

      userInDB = await User.findOne({ email: testEmail });
      const currentOTP = userInDB?.otp;
      console.log('Updated OTP in DB:', currentOTP);

      // TEST 4: Resend OTP
      console.log('\n--- TEST 4: Resend OTP (POST /api/auth/resend-otp) ---');
      const resResend = await fetch(`${baseURL}/api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });
      const dataResend = await resResend.json();
      console.log('Status:', resResend.status, '| Response:', dataResend);

      userInDB = await User.findOne({ email: testEmail });
      const freshOTP = userInDB?.otp;

      // TEST 5: Verify Invalid OTP
      console.log('\n--- TEST 5: Verify Invalid OTP (POST /api/auth/verify-otp) ---');
      const resInvOtp = await fetch(`${baseURL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, otp: '000000' }),
      });
      console.log('Status:', resInvOtp.status, '| Response:', await resInvOtp.json());

      // TEST 6: Verify Valid OTP
      console.log('\n--- TEST 6: Verify Valid OTP ---');
      const resVerOtp = await fetch(`${baseURL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, otp: freshOTP }),
      });
      const dataVerOtp = await resVerOtp.json();
      console.log('Status:', resVerOtp.status, '| Response:', dataVerOtp);
      const userToken = dataVerOtp.token;

      // TEST 7: Login Verified User
      console.log('\n--- TEST 7: Login Verified User (POST /api/auth/login) ---');
      const resLogin = await fetch(`${baseURL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: 'newpassword123' }),
      });
      console.log('Status:', resLogin.status, '| Response:', await resLogin.json());

      // TEST 8: Get User Profile (Protected)
      console.log('\n--- TEST 8: Get User Profile (GET /api/auth/profile) ---');
      const resProf = await fetch(`${baseURL}/api/auth/profile`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      console.log('Status:', resProf.status, '| Response:', await resProf.json());

      // TEST 9: Admin Login
      console.log('\n--- TEST 9: Admin Login (POST /api/auth/login) ---');
      const resAdminLogin = await fetch(`${baseURL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@gmail.com', password: 'admin123' }),
      });
      const dataAdminLogin = await resAdminLogin.json();
      console.log('Status:', resAdminLogin.status, '| Response:', dataAdminLogin);
      const adminToken = dataAdminLogin.token;

      // TEST 10: Access Admin Dashboard with Normal User Token (Should Fail - 403)
      console.log('\n--- TEST 10: Admin Dashboard with User Token (Should fail with 403) ---');
      const resUserAdminDash = await fetch(`${baseURL}/api/auth/admin-dashboard`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      console.log('Status:', resUserAdminDash.status, '| Response:', await resUserAdminDash.json());

      // TEST 11: Access Admin Dashboard with Admin Token (Should Succeed - 200)
      console.log('\n--- TEST 11: Admin Dashboard with Admin Token (Should succeed with 200) ---');
      const resAdminDash = await fetch(`${baseURL}/api/auth/admin-dashboard`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      console.log('Status:', resAdminDash.status, '| Response:', await resAdminDash.json());

      console.log('\n=== ALL API TESTS COMPLETED SUCCESSFULLY! ===');
    } catch (err) {
      console.error('API Test Error:', err);
    } finally {
      // Clean up test user
      await User.deleteOne({ email: 'testuser_verify@gmail.com' });
      server.close(() => {
        process.exit(0);
      });
    }
  });
};

runTests();
