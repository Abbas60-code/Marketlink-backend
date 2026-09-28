import Product from '../models/productModel.js';
import FarmerProfile from '../models/farmerProfileModel.js';
import cloudinary from '../config/cloudinary.js';
import mongoose from 'mongoose';

// @desc    Create product
// @route   POST /api/products
// @access  Private/Farmer or Admin
export const createProduct = async (req, res) => {
  try {
    const { name, description, price, unit, stock, category, market, isOrganic, isAvailable, isPreOrderAvailable, isFeatured, tags, imageUrl, images } = req.body;

    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'Product name and price are required' });
    }

    // Get farmer profile for the logged-in user
    let farmerProfile = await FarmerProfile.findOne({ user: req.user._id });

    // Auto-create or find farmer profile if missing (for Admin or new Farmers)
    if (!farmerProfile) {
      if (req.user.role === 'admin' || req.user.role === 'farmer') {
        farmerProfile = await FarmerProfile.create({
          user: req.user._id,
          farmName: `${req.user.name || 'Organic Farm'}`,
          description: 'MarketLink Verified Local Produce Grower',
          location: { address: 'Local Organic Region', city: '', lat: 24.8607, lng: 67.0011 },
          isVerifiedFarmer: true,
        });
      } else {
        return res.status(403).json({ success: false, message: 'You must have a farmer profile to add products' });
      }
    }

    let imageList = [];
    if (req.file) {
      imageList = [{ url: req.file.path, public_id: req.file.filename || req.file.public_id || '' }];
    } else if (imageUrl) {
      imageList = [{ url: imageUrl, public_id: '' }];
    } else if (Array.isArray(images) && images.length > 0) {
      imageList = images.map((img) => (typeof img === 'string' ? { url: img, public_id: '' } : img));
    } else {
      imageList = [{ url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80', public_id: '' }];
    }

    let parsedTags = [];
    try { parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags || []; } catch { parsedTags = []; }

    const product = await Product.create({
      name: name.trim(),
      description: description || '',
      price: Number(price),
      unit: unit || 'kg',
      stock: Number(stock) || 25,
      images: imageList,
      category: category && mongoose.Types.ObjectId.isValid(category) ? category : undefined,
      farmer: farmerProfile._id,
      market: market && mongoose.Types.ObjectId.isValid(market) ? market : undefined,
      isOrganic: isOrganic === 'true' || isOrganic === true,
      isAvailable: isAvailable !== undefined ? (isAvailable === 'true' || isAvailable === true) : (isPreOrderAvailable !== undefined ? (isPreOrderAvailable === 'true' || isPreOrderAvailable === true) : true),
      isFeatured: isFeatured === 'true' || isFeatured === true,
      tags: parsedTags,
    });

    const populated = await Product.findById(product._id)
      .populate('category', 'name slug')
      .populate({ path: 'farmer', populate: { path: 'user', select: 'name email' } })
      .populate('market', 'name location');

    res.status(201).json({ success: true, message: 'Product created successfully', data: populated });
  } catch (error) {
    console.error('Create Product Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all products (with filters)
// @route   GET /api/products
// @access  Public
export const getAllProducts = async (req, res) => {
  try {
    const { search, category, market, farmer, isAvailable, isFeatured, isOrganic, minPrice, maxPrice, sortBy, page = 1, limit = 50 } = req.query;

    let query = {};
    if (search && search.trim()) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(safeSearch, 'i');

      const Category = mongoose.model('Category');
      const FarmerProfile = mongoose.model('FarmerProfile');
      const Market = mongoose.model('Market');

      const [matchingCats, matchingFarmers, matchingMarkets] = await Promise.all([
        Category.find({ name: searchRegex }).select('_id'),
        FarmerProfile.find({ farmName: searchRegex }).select('_id'),
        Market.find({ name: searchRegex }).select('_id')
      ]);

      const orConditions = [
        { name: searchRegex },
        { description: searchRegex },
        { tags: { $in: [searchRegex] } },
        { harvestDay: searchRegex },
        { unit: searchRegex }
      ];

      if (matchingCats.length > 0) {
        orConditions.push({ category: { $in: matchingCats.map(c => c._id) } });
      }
      if (matchingFarmers.length > 0) {
        orConditions.push({ farmer: { $in: matchingFarmers.map(f => f._id) } });
      }
      if (matchingMarkets.length > 0) {
        orConditions.push({ market: { $in: matchingMarkets.map(m => m._id) } });
      }

      query.$or = orConditions;
    }
    
    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        query.category = category;
      } else {
        const Category = mongoose.model('Category');
        const catObj = await Category.findOne({ $or: [{ slug: category }, { name: { $regex: new RegExp(`^${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }] });
        if (catObj) query.category = catObj._id;
      }
    }

    if (market && mongoose.Types.ObjectId.isValid(market)) query.market = market;
    if (farmer && mongoose.Types.ObjectId.isValid(farmer)) query.farmer = farmer;
    if (isAvailable !== undefined) query.isAvailable = isAvailable === 'true';
    if (isFeatured !== undefined) query.isFeatured = isFeatured === 'true';
    if (isOrganic !== undefined) query.isOrganic = isOrganic === 'true' || isOrganic === true;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    let sort = { createdAt: -1 };
    if (sortBy === 'price_asc') sort = { price: 1 };
    else if (sortBy === 'price_desc') sort = { price: -1 };
    else if (sortBy === 'rating') sort = { rating: -1 };
    else if (sortBy === 'featured') sort = { isFeatured: -1, createdAt: -1 };

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .populate('category', 'name slug')
      .populate({ path: 'farmer', select: 'farmName slug profileImage rating', populate: { path: 'user', select: 'name' } })
      .populate('market', 'name location marketDays')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      count: products.length,
      total,
      pages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      data: products,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single product by ID or slug
// @route   GET /api/products/:idOrSlug
// @access  Public
export const getProductByIdOrSlug = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let query = mongoose.Types.ObjectId.isValid(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug };
    const product = await Product.findOne(query)
      .populate('category', 'name slug')
      .populate({ path: 'farmer', populate: { path: 'user', select: 'name email profileImage' } })
      .populate('market', 'name location marketDays openTime closeTime');

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Farmer (own) or Admin
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('farmer');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Check ownership (farmer can only update own products)
    if (req.user.role !== 'admin') {
      const farmerProfile = await FarmerProfile.findOne({ user: req.user._id });
      if (!farmerProfile || product.farmer?._id?.toString() !== farmerProfile._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this product' });
      }
    }

    const { name, description, price, unit, stock, category, market, isOrganic, isAvailable, isFeatured, tags } = req.body;

    if (name !== undefined) product.name = name.trim();
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = Number(price);
    if (unit !== undefined) product.unit = unit;
    if (stock !== undefined) product.stock = Number(stock);
    if (isOrganic !== undefined) product.isOrganic = isOrganic === 'true' || isOrganic === true;
    if (isAvailable !== undefined) product.isAvailable = isAvailable === 'true' || isAvailable === true;
    if (isFeatured !== undefined) product.isFeatured = isFeatured === 'true' || isFeatured === true;
    if (category !== undefined) product.category = mongoose.Types.ObjectId.isValid(category) ? category : undefined;
    if (market !== undefined) product.market = mongoose.Types.ObjectId.isValid(market) ? market : undefined;
    if (tags !== undefined) { try { product.tags = typeof tags === 'string' ? JSON.parse(tags) : tags; } catch {} }

    if (req.file) {
      product.images = [{ url: req.file.path, public_id: req.file.filename || req.file.public_id || '' }];
    }

    const updated = await product.save();
    res.json({ success: true, message: 'Product updated', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Farmer (own) or Admin
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (req.user.role !== 'admin') {
      const farmerProfile = await FarmerProfile.findOne({ user: req.user._id });
      if (!farmerProfile || product.farmer?.toString() !== farmerProfile._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to delete this product' });
      }
    }

    // Delete images from Cloudinary
    for (const img of product.images) {
      if (img.public_id) { try { await cloudinary.uploader.destroy(img.public_id); } catch {} }
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Product deleted', deletedId: req.params.id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get farmer's own products
// @route   GET /api/products/my-products
// @access  Private/Farmer
export const getMyProducts = async (req, res) => {
  try {
    const farmerProfile = await FarmerProfile.findOne({ user: req.user._id });
    if (!farmerProfile) return res.status(404).json({ success: false, message: 'Farmer profile not found' });

    const products = await Product.find({ farmer: farmerProfile._id })
      .populate('category', 'name')
      .populate('market', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: products.length, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
