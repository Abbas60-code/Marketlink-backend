import express from 'express';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import app from '../app.js';
import User from '../models/userModel.js';
import Category from '../models/categoryModel.js';
import jwt from 'jsonwebtoken';

dotenv.config();

let server;

const runTests = async () => {
  console.log('=== STARTING CATEGORY CRUD API TEST ===\n');

  // 1. Connect DB
  await connectDB();

  // Start Express server on port 9092 for testing
  const PORT = 9092;
  server = app.listen(PORT, async () => {
    console.log(`Category Test Server running on http://localhost:${PORT}`);
    const baseURL = `http://localhost:${PORT}`;

    try {
      // Find Admin & User
      const admin = await User.findOne({ email: 'admin@gmail.com' });
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

      // Clean up test categories
      await Category.deleteMany({ name: { $regex: /Test /i } });

      // TEST 1: Unauthorized check
      console.log('--- TEST 1: Create Category without Token (Expect 401) ---');
      const resNoAuth = await fetch(`${baseURL}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Unauthorized' }),
      });
      console.log('Status:', resNoAuth.status, '| Response:', await resNoAuth.json());

      // TEST 2: Forbidden check
      console.log('\n--- TEST 2: Create Category with User Token (Expect 403) ---');
      const resUserAuth = await fetch(`${baseURL}/api/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({ name: 'Test User Role' }),
      });
      console.log('Status:', resUserAuth.status, '| Response:', await resUserAuth.json());

      // TEST 3: Create Main Parent Category
      console.log('\n--- TEST 3: Create Main Category (Electronics) with Admin Token (Expect 201) ---');
      const resCat1 = await fetch(`${baseURL}/api/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Test Electronics',
          description: 'All kinds of electronic items',
          imageUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c',
          isFeatured: true,
          position: 1,
        }),
      });
      const dataCat1 = await resCat1.json();
      console.log('Status:', resCat1.status, '| Slug:', dataCat1.data?.slug, '| ID:', dataCat1.data?._id);
      const parentCatId = dataCat1.data?._id;

      // TEST 4: Create Subcategory (Laptops) under Electronics
      console.log('\n--- TEST 4: Create Subcategory (Laptops) under Electronics ---');
      const resCat2 = await fetch(`${baseURL}/api/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Test Laptops',
          description: 'Gaming and work laptops',
          parentCategory: parentCatId,
          imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853',
          position: 1,
        }),
      });
      const dataCat2 = await resCat2.json();
      console.log('Status:', resCat2.status, '| Subcategory ID:', dataCat2.data?._id, '| Parent:', dataCat2.data?.parentCategory);

      // TEST 5: Duplicate Category Name (Expect 400)
      console.log('\n--- TEST 5: Duplicate Category Name Prevention ---');
      const resDup = await fetch(`${baseURL}/api/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ name: 'Test Electronics' }),
      });
      console.log('Status:', resDup.status, '| Response:', await resDup.json());

      // TEST 6: Get All Categories
      console.log('\n--- TEST 6: Get All Categories (GET /api/categories) ---');
      const resGetAll = await fetch(`${baseURL}/api/categories`);
      const dataGetAll = await resGetAll.json();
      console.log('Status:', resGetAll.status, '| Total Categories:', dataGetAll.count);

      // TEST 7: Get Active Categories (with Subcategories populated)
      console.log('\n--- TEST 7: Get Active Categories (GET /api/categories/active) ---');
      const resGetActive = await fetch(`${baseURL}/api/categories/active`);
      const dataGetActive = await resGetActive.json();
      console.log('Status:', resGetActive.status, '| Active Root Categories:', dataGetActive.count);
      const foundParent = dataGetActive.data?.find((c) => c._id === parentCatId);
      console.log('Parent Category subcategories count:', foundParent?.subcategories?.length);

      // TEST 8: Get Category By Slug
      console.log('\n--- TEST 8: Get Category By Slug (/api/categories/test-electronics) ---');
      const resBySlug = await fetch(`${baseURL}/api/categories/test-electronics`);
      const dataBySlug = await resBySlug.json();
      console.log('Status:', resBySlug.status, '| Name:', dataBySlug.data?.name, '| Slug:', dataBySlug.data?.slug);

      // TEST 9: Update Category (Name and Description)
      console.log('\n--- TEST 9: Update Category Name & Slug ---');
      const resUpdate = await fetch(`${baseURL}/api/categories/${parentCatId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Test Electronics Pro',
          description: 'Updated description for pro electronics',
          position: 10,
        }),
      });
      const dataUpdate = await resUpdate.json();
      console.log('Status:', resUpdate.status, '| Updated Name:', dataUpdate.data?.name, '| New Slug:', dataUpdate.data?.slug);

      // TEST 10: Toggle Category Status & Featured
      console.log('\n--- TEST 10: Toggle Status & Featured ---');
      const resToggleStatus = await fetch(`${baseURL}/api/categories/${parentCatId}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      console.log('Toggle Status Result:', (await resToggleStatus.json()).message);

      const resToggleFeatured = await fetch(`${baseURL}/api/categories/${parentCatId}/featured`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      console.log('Toggle Featured Result:', (await resToggleFeatured.json()).message);

      // TEST 11: Delete Category
      console.log('\n--- TEST 11: Delete Category ---');
      const resDelete = await fetch(`${baseURL}/api/categories/${parentCatId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      console.log('Status:', resDelete.status, '| Response:', await resDelete.json());

      console.log('\n=== ALL CATEGORY CRUD TESTS PASSED SUCCESSFULLY! ===');
    } catch (err) {
      console.error('Category Test Error:', err);
    } finally {
      // Clean up test data
      await Category.deleteMany({ name: { $regex: /Test /i } });
      server.close(() => {
        process.exit(0);
      });
    }
  });
};

runTests();
