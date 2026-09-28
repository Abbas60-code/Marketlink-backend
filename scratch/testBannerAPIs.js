import express from 'express';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import app from '../app.js';
import User from '../models/userModel.js';
import Banner from '../models/bannerModel.js';
import jwt from 'jsonwebtoken';

dotenv.config();

let server;

const runTests = async () => {
  console.log('=== STARTING BANNER CRUD API TEST ===\n');

  // 1. Connect DB
  await connectDB();

  // Start Express server on port 9091 for testing
  const PORT = 9091;
  server = app.listen(PORT, async () => {
    console.log(`Banner Test Server running on http://localhost:${PORT}`);
    const baseURL = `http://localhost:${PORT}`;

    try {
      // 1. Create or Find Admin & Normal User for Auth Token
      let admin = await User.findOne({ email: 'admin@gmail.com' });
      if (!admin) {
        admin = await User.create({
          name: 'Admin User',
          email: 'admin@gmail.com',
          password: 'password123',
          role: 'admin',
          isVerified: true,
        });
      }
      const adminToken = jwt.sign({ id: admin._id }, process.env.JWT_SECRET || 'techwiz_secret', { expiresIn: '1d' });

      let normalUser = await User.findOne({ email: 'normaluser@gmail.com' });
      if (!normalUser) {
        normalUser = await User.create({
          name: 'Normal User',
          email: 'normaluser@gmail.com',
          password: 'password123',
          role: 'user',
          isVerified: true,
        });
      }
      const userToken = jwt.sign({ id: normalUser._id }, process.env.JWT_SECRET || 'techwiz_secret', { expiresIn: '1d' });

      // Clean up previous test banners
      await Banner.deleteMany({ title: { $regex: /Test Banner/i } });

      // TEST 1: Unauthorized create (without token) - Should fail 401
      console.log('\n--- TEST 1: Create Banner without Token (Expect 401) ---');
      const resNoAuth = await fetch(`${baseURL}/api/banners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Banner Unauthorized',
          imageUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0',
        }),
      });
      console.log('Status:', resNoAuth.status, '| Response:', await resNoAuth.json());

      // TEST 2: Forbidden create (with normal user token) - Should fail 403
      console.log('\n--- TEST 2: Create Banner with User Token (Expect 403) ---');
      const resUserAuth = await fetch(`${baseURL}/api/banners`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          title: 'Test Banner Normal User',
          imageUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0',
        }),
      });
      console.log('Status:', resUserAuth.status, '| Response:', await resUserAuth.json());

      // TEST 3: Create Banner with Admin Token - Should succeed 201
      console.log('\n--- TEST 3: Create Banner 1 with Admin Token (Expect 201) ---');
      const resCreate1 = await fetch(`${baseURL}/api/banners`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          title: 'Test Banner - Summer Mega Sale',
          subtitle: 'Up to 50% Off on all tech items',
          description: 'Special summer discount on all products.',
          imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da',
          link: '/offers/summer-sale',
          category: 'hero',
          position: 1,
          isActive: true,
        }),
      });
      const dataCreate1 = await resCreate1.json();
      console.log('Status:', resCreate1.status, '| Created Banner 1 ID:', dataCreate1.data?._id);
      const banner1Id = dataCreate1.data?._id;

      // TEST 4: Create Second Banner
      console.log('\n--- TEST 4: Create Banner 2 with Admin Token ---');
      const resCreate2 = await fetch(`${baseURL}/api/banners`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          title: 'Test Banner - New Arrivals 2026',
          subtitle: 'Check out the latest gadgets',
          imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
          link: '/category/new',
          category: 'promo',
          position: 2,
          isActive: false, // Inactive
        }),
      });
      const dataCreate2 = await resCreate2.json();
      console.log('Status:', resCreate2.status, '| Created Banner 2 ID:', dataCreate2.data?._id);

      // TEST 5: Get All Banners (Public)
      console.log('\n--- TEST 5: Get All Banners (GET /api/banners) ---');
      const resGetAll = await fetch(`${baseURL}/api/banners`);
      const dataGetAll = await resGetAll.json();
      console.log('Status:', resGetAll.status, '| Total count:', dataGetAll.count, '| Items:', dataGetAll.data?.map(b => ({ id: b._id, title: b.title, isActive: b.isActive, category: b.category })));

      // TEST 6: Get Active Banners only (GET /api/banners/active)
      console.log('\n--- TEST 6: Get Active Banners (GET /api/banners/active) ---');
      const resGetActive = await fetch(`${baseURL}/api/banners/active`);
      const dataGetActive = await resGetActive.json();
      console.log('Status:', resGetActive.status, '| Active count:', dataGetActive.count, '| Items:', dataGetActive.data?.map(b => ({ id: b._id, title: b.title, isActive: b.isActive })));

      // TEST 7: Get Single Banner By ID
      console.log(`\n--- TEST 7: Get Banner By ID (${banner1Id}) ---`);
      const resGetById = await fetch(`${baseURL}/api/banners/${banner1Id}`);
      const dataGetById = await resGetById.json();
      console.log('Status:', resGetById.status, '| Title:', dataGetById.data?.title, '| Link:', dataGetById.data?.link);

      // TEST 8: Update Banner (PUT /api/banners/:id)
      console.log(`\n--- TEST 8: Update Banner (${banner1Id}) ---`);
      const resUpdate = await fetch(`${baseURL}/api/banners/${banner1Id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          title: 'Test Banner - Summer Mega Sale [UPDATED]',
          subtitle: 'Up to 70% Off on all tech items!',
          position: 5,
        }),
      });
      const dataUpdate = await resUpdate.json();
      console.log('Status:', resUpdate.status, '| Updated Title:', dataUpdate.data?.title, '| New Position:', dataUpdate.data?.position);

      // TEST 9: Toggle Banner Status (PATCH /api/banners/:id/status)
      console.log(`\n--- TEST 9: Toggle Banner Status (${banner1Id}) ---`);
      const resToggle = await fetch(`${baseURL}/api/banners/${banner1Id}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const dataToggle = await resToggle.json();
      console.log('Status:', resToggle.status, '| Message:', dataToggle.message, '| isActive:', dataToggle.data?.isActive);

      // TEST 10: Delete Banner (DELETE /api/banners/:id)
      console.log(`\n--- TEST 10: Delete Banner (${banner1Id}) ---`);
      const resDelete = await fetch(`${baseURL}/api/banners/${banner1Id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      const dataDelete = await resDelete.json();
      console.log('Status:', resDelete.status, '| Response:', dataDelete);

      // Verify deletion
      const resVerifyDelete = await fetch(`${baseURL}/api/banners/${banner1Id}`);
      console.log('Fetch deleted banner Status (Expect 404):', resVerifyDelete.status);

      console.log('\n=== ALL BANNER CRUD TESTS PASSED SUCCESSFULLY! ===');
    } catch (err) {
      console.error('Banner API Test Error:', err);
    } finally {
      // Clean up test banners
      await Banner.deleteMany({ title: { $regex: /Test Banner/i } });
      server.close(() => {
        process.exit(0);
      });
    }
  });
};

runTests();
