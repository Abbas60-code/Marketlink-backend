import Market from '../models/marketModel.js';
import cloudinary from '../config/cloudinary.js';

// @desc    Create market
// @route   POST /api/markets
// @access  Private/Admin
export const createMarket = async (req, res) => {
  try {
    const { name, description, location, marketDays, openTime, closeTime, pickupStartTime, pickupEndTime, isFeatured, imageUrl } = req.body;

    if (!name) return res.status(400).json({ success: false, message: 'Market name is required' });

    let imageData = { url: '', public_id: '' };
    if (req.file) {
      imageData = { url: req.file.path, public_id: req.file.filename || req.file.public_id || '' };
    } else if (imageUrl) {
      imageData = { url: imageUrl, public_id: '' };
    }

    let parsedLocation = {};
    try { parsedLocation = typeof location === 'string' ? JSON.parse(location) : location || {}; } catch { parsedLocation = {}; }

    let parsedDays = [];
    try { parsedDays = typeof marketDays === 'string' ? JSON.parse(marketDays) : marketDays || []; } catch { parsedDays = []; }

    const market = await Market.create({
      name: name.trim(),
      description: description || '',
      image: imageData,
      location: parsedLocation,
      marketDays: parsedDays,
      openTime: openTime || '',
      closeTime: closeTime || '',
      pickupStartTime: pickupStartTime || '',
      pickupEndTime: pickupEndTime || '',
      isFeatured: isFeatured === 'true' || isFeatured === true,
      managedBy: req.user?._id,
    });

    res.status(201).json({ success: true, message: 'Market created successfully', data: market });
  } catch (error) {
    console.error('Create Market Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all markets
// @route   GET /api/markets
// @access  Public
export const getAllMarkets = async (req, res) => {
  try {
    const { isActive, isFeatured, search, lat, lng, radiusKm } = req.query;
    let query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';
    if (search && search.trim()) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(safeSearch, 'i');
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { 'location.city': searchRegex },
        { 'location.address': searchRegex },
        { 'location.state': searchRegex },
      ];
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);
    const radiusNum = Math.min(Math.max(Number(radiusKm) || 50, 1), 300);
    const useGeo = !Number.isNaN(latNum) && !Number.isNaN(lngNum)
      && latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180;

    if (useGeo) {
      const R = 6371;
      const latRad = (Math.PI / 180) * latNum;

      const pipeline = [];
      pipeline.push({
        $match: {
          ...query,
          $and: [
            { 'location.coordinates.lat': { $exists: true, $ne: null } },
            { 'location.coordinates.lng': { $exists: true, $ne: null } },
          ],
        }
      });

      pipeline.push({
        $addFields: {
          _dLat: { $subtract: [{ $multiply: [{ $literal: Math.PI / 180 }, '$location.coordinates.lat'] }, latRad] },
          _dLng: { $subtract: [{ $multiply: [{ $literal: Math.PI / 180 }, '$location.coordinates.lng'] }, (Math.PI / 180) * lngNum] },
          _lat1Rad: { $multiply: [{ $literal: Math.PI / 180 }, '$location.coordinates.lat'] },
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
      pipeline.push({ $sort: { distanceKm: 1, isFeatured: -1, createdAt: -1 } });
      pipeline.push({ $project: { _dLat: 0, _dLng: 0, _lat1Rad: 0, _a: 0 } });

      const marketsWithCoords = await Market.aggregate(pipeline);

      const withoutCoords = await Market.find({
        ...query,
        $or: [
          { 'location.coordinates.lat': { $exists: false } },
          { 'location.coordinates.lat': null },
          { 'location.coordinates.lng': { $exists: false } },
          { 'location.coordinates.lng': null },
        ],
      }).sort({ isFeatured: -1, createdAt: -1 });

      const combined = [...marketsWithCoords, ...withoutCoords.map(m => ({ ...m.toObject(), distanceKm: null }))];

      res.json({ success: true, count: combined.length, data: combined, appliedRadiusKm: radiusNum });
      return;
    }

    const markets = await Market.find(query).sort({ isFeatured: -1, createdAt: -1 });
    res.json({ success: true, count: markets.length, data: markets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single market
// @route   GET /api/markets/:id
// @access  Public
export const getMarketById = async (req, res) => {
  try {
    const market = await Market.findById(req.params.id);
    if (!market) return res.status(404).json({ success: false, message: 'Market not found' });
    res.json({ success: true, data: market });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update market
// @route   PUT /api/markets/:id
// @access  Private/Admin
export const updateMarket = async (req, res) => {
  try {
    const market = await Market.findById(req.params.id);
    if (!market) return res.status(404).json({ success: false, message: 'Market not found' });

    const { name, description, location, marketDays, openTime, closeTime, pickupStartTime, pickupEndTime, isFeatured, isActive, imageUrl } = req.body;

    if (name !== undefined) market.name = name.trim();
    if (description !== undefined) market.description = description;
    if (openTime !== undefined) market.openTime = openTime;
    if (closeTime !== undefined) market.closeTime = closeTime;
    if (pickupStartTime !== undefined) market.pickupStartTime = pickupStartTime;
    if (pickupEndTime !== undefined) market.pickupEndTime = pickupEndTime;
    if (isFeatured !== undefined) market.isFeatured = isFeatured === 'true' || isFeatured === true;
    if (isActive !== undefined) market.isActive = isActive === 'true' || isActive === true;
    if (location) { try { market.location = typeof location === 'string' ? JSON.parse(location) : location; } catch {} }
    if (marketDays) { try { market.marketDays = typeof marketDays === 'string' ? JSON.parse(marketDays) : marketDays; } catch {} }

    if (req.file) {
      if (market.image?.public_id) { try { await cloudinary.uploader.destroy(market.image.public_id); } catch {} }
      market.image = { url: req.file.path, public_id: req.file.filename || req.file.public_id || '' };
    } else if (imageUrl) {
      market.image = { url: imageUrl, public_id: '' };
    }

    const updated = await market.save();
    res.json({ success: true, message: 'Market updated', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete market
// @route   DELETE /api/markets/:id
// @access  Private/Admin
export const deleteMarket = async (req, res) => {
  try {
    const market = await Market.findById(req.params.id);
    if (!market) return res.status(404).json({ success: false, message: 'Market not found' });
    if (market.image?.public_id) { try { await cloudinary.uploader.destroy(market.image.public_id); } catch {} }
    await Market.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Market deleted', deletedId: req.params.id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
