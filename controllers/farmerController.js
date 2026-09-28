import mongoose from 'mongoose';
import FarmerProfile from '../models/farmerProfileModel.js';
import Product from '../models/productModel.js';
import User from '../models/userModel.js';
import cloudinary from '../config/cloudinary.js';

// @desc    Create or update farmer profile
// @route   POST /api/farmers/profile
// @access  Private/Farmer or Admin
export const createOrUpdateFarmerProfile = async (req, res) => {
  try {
    const {
      farmName,
      contactPerson,
      phone,
      email,
      address,
      description,
      stallNumber,
      market,
      operatingDays,
      pickupWindows,
      certifications,
      specialties,
      location,
    } = req.body;

    if (!farmName) return res.status(400).json({ success: false, message: 'Farm/stall name is required' });

    let parsedCerts = [], parsedSpecs = [], parsedDays = [], parsedWindows = [], parsedLoc = { address: '', city: '', lat: 24.8607, lng: 67.0011 };
    try { parsedCerts = typeof certifications === 'string' ? JSON.parse(certifications) : certifications || []; } catch {}
    try { parsedSpecs = typeof specialties === 'string' ? JSON.parse(specialties) : specialties || []; } catch {}
    try { parsedDays = typeof operatingDays === 'string' ? JSON.parse(operatingDays) : operatingDays || []; } catch {}
    try { parsedWindows = typeof pickupWindows === 'string' ? JSON.parse(pickupWindows) : pickupWindows || []; } catch {}
    try {
      if (typeof location === 'string') parsedLoc = JSON.parse(location);
      else if (location && typeof location === 'object') parsedLoc = { ...parsedLoc, ...location };
    } catch {}

    let existing = await FarmerProfile.findOne({ user: req.user._id });

    if (existing) {
      existing.farmName = farmName.trim();
      if (contactPerson !== undefined) existing.contactPerson = contactPerson.trim();
      if (phone !== undefined) existing.phone = phone.trim();
      if (email !== undefined) existing.email = email.trim();
      if (address !== undefined) existing.address = address.trim();
      if (description !== undefined) existing.description = description;
      if (stallNumber !== undefined) existing.stallNumber = stallNumber;
      if (market !== undefined) existing.market = market || undefined;
      existing.operatingDays = parsedDays;
      existing.pickupWindows = parsedWindows;
      existing.certifications = parsedCerts;
      existing.specialties = parsedSpecs;
      existing.location = parsedLoc;

      if (req.file) {
        if (existing.profileImage?.public_id) { try { await cloudinary.uploader.destroy(existing.profileImage.public_id); } catch {} }
        existing.profileImage = { url: req.file.path, public_id: req.file.filename || req.file.public_id || '' };
      }

      await existing.save();

      const populated = await FarmerProfile.findById(existing._id)
        .populate('user', 'name email')
        .populate('market', 'name location marketDays openTime closeTime');

      return res.json({ success: true, message: 'Farmer profile updated successfully', data: populated });
    }

    let profileImageData = { url: '', public_id: '' };
    if (req.file) profileImageData = { url: req.file.path, public_id: req.file.filename || req.file.public_id || '' };

    const profile = await FarmerProfile.create({
      user: req.user._id,
      farmName: farmName.trim(),
      contactPerson: contactPerson || req.user.name || '',
      phone: phone || req.user.phone || '',
      email: email || req.user.email || '',
      address: address || '',
      description: description || '',
      stallNumber: stallNumber || '',
      market: market || undefined,
      operatingDays: parsedDays,
      pickupWindows: parsedWindows,
      certifications: parsedCerts,
      specialties: parsedSpecs,
      location: parsedLoc,
      profileImage: profileImageData,
    });

    const populated = await FarmerProfile.findById(profile._id)
      .populate('user', 'name email')
      .populate('market', 'name location marketDays openTime closeTime');

    res.status(201).json({ success: true, message: 'Farmer profile created successfully', data: populated });
  } catch (error) {
    console.error('Farmer Profile Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all active farmers (Customer / Public browsing)
// @route   GET /api/farmers
// @access  Public
export const getAllFarmers = async (req, res) => {
  try {
    const { market, search, day, isActive, lat, lng, radiusKm } = req.query;
    let query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (market) query.market = market;
    if (day) {
      const safeDay = day.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.operatingDays = { $in: [new RegExp(safeDay, 'i')] };
    }

    if (search && search.trim()) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(safeSearch, 'i');

      const matchingUsers = await User.find({
        $or: [{ name: searchRegex }, { email: searchRegex }]
      }).select('_id');

      const orConditions = [
        { farmName: searchRegex },
        { description: searchRegex },
        { contactPerson: searchRegex },
        { address: searchRegex },
        { 'location.city': searchRegex },
        { 'location.address': searchRegex },
        { stallNumber: searchRegex },
        { specialties: { $in: [searchRegex] } },
      ];

      if (matchingUsers.length > 0) {
        orConditions.push({ user: { $in: matchingUsers.map(u => u._id) } });
      }

      query.$or = orConditions;
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);
    const radiusNum = Math.min(Math.max(Number(radiusKm) || 50, 1), 300);
    const useGeo = !Number.isNaN(latNum) && !Number.isNaN(lngNum)
      && latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180;

    if (useGeo) {
      const R = 6371;
      const latRad = (Math.PI / 180) * latNum;
      const lngRad = (Math.PI / 180) * lngNum;

      const pipeline = [];
      pipeline.push({ $match: { ...query, 'location.lat': { $exists: true, $ne: null }, 'location.lng': { $exists: true, $ne: null } } });

      pipeline.push({
        $addFields: {
          _dLat: { $subtract: [{ $multiply: [{ $literal: Math.PI / 180 }, '$location.lat'] }, latRad] },
          _dLng: { $subtract: [{ $multiply: [{ $literal: Math.PI / 180 }, '$location.lng'] }, lngRad] },
          _lat1Rad: { $multiply: [{ $literal: Math.PI / 180 }, '$location.lat'] },
        }
      });

      pipeline.push({
        $addFields: {
          _a: {
            $add: [
              { $pow: [{ $sin: { $divide: ['$_dLat', 2] } }, 2] },
              { $multiply: [
                { $cos: latRad },
                { $cos: '$_lat1Rad' },
                { $pow: [{ $sin: { $divide: ['$_dLng', 2] } }, 2] },
              ]},
            ]
          }
        }
      });

      pipeline.push({
        $addFields: {
          distanceKm: {
            $multiply: [
              2 * R,
              { $atan2: [{ $sqrt: '$_a' }, { $sqrt: { $subtract: [1, '$_a'] } }] },
            ]
          }
        }
      });

      pipeline.push({ $match: { distanceKm: { $lte: radiusNum } } });
      pipeline.push({ $sort: { distanceKm: 1 } });

      pipeline.push({
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user',
          pipeline: [{ $project: { name: 1, email: 1, profileImage: 1 } }],
        }
      });
      pipeline.push({ $unwind: { path: '$user', preserveNullAndEmptyArrays: true } });

      pipeline.push({
        $lookup: {
          from: 'markets',
          localField: 'market',
          foreignField: '_id',
          as: 'market',
          pipeline: [{ $project: { name: 1, location: 1, marketDays: 1, openTime: 1, closeTime: 1, pickupStartTime: 1, pickupEndTime: 1 } }],
        }
      });
      pipeline.push({ $unwind: { path: '$market', preserveNullAndEmptyArrays: true } });

      pipeline.push({ $project: { _dLat: 0, _dLng: 0, _lat1Rad: 0, _a: 0 } });

      const farmersWithCoords = await FarmerProfile.aggregate(pipeline);

      const withoutCoords = await FarmerProfile.find({
        ...query,
        $or: [{ 'location.lat': { $exists: false } }, { 'location.lat': null }, { 'location.lng': { $exists: false } }, { 'location.lng': null }],
      })
        .populate('user', 'name email profileImage')
        .populate('market', 'name location marketDays openTime closeTime pickupStartTime pickupEndTime')
        .sort({ rating: -1, createdAt: -1 });

      const combined = [...farmersWithCoords, ...withoutCoords.map(f => ({ ...f.toObject(), distanceKm: null }))];

      res.json({ success: true, count: combined.length, data: combined, appliedRadiusKm: radiusNum });
      return;
    }

    const farmers = await FarmerProfile.find(query)
      .populate('user', 'name email profileImage')
      .populate('market', 'name location marketDays openTime closeTime pickupStartTime pickupEndTime')
      .sort({ rating: -1, createdAt: -1 });

    res.json({ success: true, count: farmers.length, data: farmers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single farmer profile by ID or slug
// @route   GET /api/farmers/:idOrSlug
// @access  Public
export const getFarmerById = async (req, res) => {
  try {
    const { id } = req.params;
    let query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { slug: id };

    const farmer = await FarmerProfile.findOne(query)
      .populate('user', 'name email profileImage phone')
      .populate('market', 'name location marketDays openTime closeTime pickupStartTime pickupEndTime');

    if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found' });

    // Fetch active products for this farmer
    const products = await Product.find({ farmer: farmer._id, isAvailable: true })
      .populate('category', 'name slug')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: { ...farmer.toObject(), products } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get logged in farmer profile
// @route   GET /api/farmers/me
// @access  Private/Farmer
export const getMyFarmerProfile = async (req, res) => {
  try {
    let profile = await FarmerProfile.findOne({ user: req.user._id })
      .populate('user', 'name email profileImage phone address')
      .populate('market', 'name location marketDays openTime closeTime pickupStartTime pickupEndTime');

    // If farmer profile doesn't exist yet, auto-create a default one
    if (!profile) {
      profile = await FarmerProfile.create({
        user: req.user._id,
        farmName: `${req.user.name}'s Farm Stall`,
        contactPerson: req.user.name,
        email: req.user.email,
        phone: req.user.phone || '',
        description: 'Locally grown fresh produce and organic goods.',
        operatingDays: ['Saturday', 'Sunday'],
        pickupWindows: [
          { day: 'Saturday', startTime: '09:00 AM', endTime: '01:00 PM', cutoffHours: 2, maxOrders: 30 },
          { day: 'Sunday', startTime: '09:00 AM', endTime: '01:00 PM', cutoffHours: 2, maxOrders: 30 },
        ],
      });
      profile = await FarmerProfile.findById(profile._id)
        .populate('user', 'name email profileImage phone address')
        .populate('market', 'name location marketDays openTime closeTime');
    }

    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Bulk update weekly stock and prices (Farmer)
// @route   PUT /api/farmers/weekly-stock
// @access  Private/Farmer
export const updateWeeklyStock = async (req, res) => {
  try {
    const { items } = req.body; // Array of { productId, stock, price, isAvailable, weeklyStock }

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Items array required' });
    }

    const farmerProfile = await FarmerProfile.findOne({ user: req.user._id });
    if (!farmerProfile) return res.status(404).json({ success: false, message: 'Farmer profile not found' });

    const updatePromises = items.map(async (item) => {
      const prod = await Product.findOne({ _id: item.productId, farmer: farmerProfile._id });
      if (prod) {
        if (item.stock !== undefined) prod.stock = Number(item.stock);
        if (item.weeklyStock !== undefined) prod.weeklyStock = Number(item.weeklyStock);
        if (item.price !== undefined) prod.price = Number(item.price);
        if (item.isAvailable !== undefined) prod.isAvailable = Boolean(item.isAvailable);
        await prod.save();
      }
    });

    await Promise.all(updatePromises);

    const updatedProducts = await Product.find({ farmer: farmerProfile._id })
      .populate('category', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      message: 'Weekly stock & pricing updated successfully',
      data: updatedProducts,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Save / Update pickup slots for Farmer
// @route   PUT /api/farmers/pickup-slots
// @access  Private/Farmer
export const updatePickupSlots = async (req, res) => {
  try {
    const { pickupWindows, operatingDays } = req.body;

    const farmerProfile = await FarmerProfile.findOne({ user: req.user._id });
    if (!farmerProfile) return res.status(404).json({ success: false, message: 'Farmer profile not found' });

    if (pickupWindows) farmerProfile.pickupWindows = pickupWindows;
    if (operatingDays) farmerProfile.operatingDays = operatingDays;

    await farmerProfile.save();

    res.json({
      success: true,
      message: 'Pickup slots and operating schedule updated',
      data: farmerProfile,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin: List all farmers with full status
// @route   GET /api/farmers/admin/all
// @access  Private/Admin
export const getAdminFarmers = async (req, res) => {
  try {
    const farmers = await FarmerProfile.find()
      .populate('user', 'name email phone isVerified isActive')
      .populate('market', 'name location')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: farmers.length, data: farmers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Admin: Toggle farmer status (approve, suspend, activate, deactivate)
// @route   PATCH /api/farmers/:id/status
// @access  Private/Admin
export const updateFarmerStatus = async (req, res) => {
  try {
    const { isActive, isVerifiedFarmer } = req.body;
    const farmer = await FarmerProfile.findById(req.params.id);
    if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found' });

    if (isActive !== undefined) farmer.isActive = Boolean(isActive);
    if (isVerifiedFarmer !== undefined) farmer.isVerifiedFarmer = Boolean(isVerifiedFarmer);

    await farmer.save();

    res.json({
      success: true,
      message: `Farmer status updated (Active: ${farmer.isActive}, Approved: ${farmer.isVerifiedFarmer})`,
      data: farmer,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete farmer profile (Admin only)
// @route   DELETE /api/farmers/:id
// @access  Private/Admin
export const deleteFarmerProfile = async (req, res) => {
  try {
    const profile = await FarmerProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ success: false, message: 'Farmer not found' });
    if (profile.profileImage?.public_id) { try { await cloudinary.uploader.destroy(profile.profileImage.public_id); } catch {} }
    await FarmerProfile.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Farmer profile deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
