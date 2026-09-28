import Favorite from '../models/favoriteModel.js';
import Product from '../models/productModel.js';
import FarmerProfile from '../models/farmerProfileModel.js';
import Market from '../models/marketModel.js';

// @desc    Get all favorites for logged in user
// @route   GET /api/favorites
// @access  Private
export const getMyFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.find({ user: req.user._id })
      .populate({
        path: 'product',
        populate: [
          { path: 'category', select: 'name slug' },
          { path: 'farmer', select: 'farmName profileImage rating' },
          { path: 'market', select: 'name location' },
        ],
      })
      .populate({
        path: 'farmer',
        populate: [
          { path: 'user', select: 'name email profileImage' },
          { path: 'market', select: 'name location' },
        ],
      })
      .populate('market')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: favorites.length, data: favorites });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add item to favorites
// @route   POST /api/favorites
// @access  Private
export const addFavorite = async (req, res) => {
  try {
    const { itemType, itemId } = req.body;

    if (!itemType || !itemId) {
      return res.status(400).json({ success: false, message: 'Item type and item ID are required' });
    }

    let favoriteData = { user: req.user._id, itemType };

    if (itemType === 'product') {
      const prod = await Product.findById(itemId);
      if (!prod) return res.status(404).json({ success: false, message: 'Product not found' });
      favoriteData.product = itemId;
    } else if (itemType === 'farmer') {
      const farmer = await FarmerProfile.findById(itemId);
      if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found' });
      favoriteData.farmer = itemId;
    } else if (itemType === 'market') {
      const market = await Market.findById(itemId);
      if (!market) return res.status(404).json({ success: false, message: 'Market not found' });
      favoriteData.market = itemId;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid item type' });
    }

    // Check if already favorited
    const query = { user: req.user._id, itemType };
    if (favoriteData.product) query.product = favoriteData.product;
    if (favoriteData.farmer) query.farmer = favoriteData.farmer;
    if (favoriteData.market) query.market = favoriteData.market;

    const existing = await Favorite.findOne(query);
    if (existing) {
      return res.json({ success: true, message: 'Item already in favorites', data: existing });
    }

    const favorite = await Favorite.create(favoriteData);
    res.status(201).json({ success: true, message: 'Added to favorites', data: favorite });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Remove from favorites
// @route   DELETE /api/favorites/:id
// @access  Private
export const removeFavorite = async (req, res) => {
  try {
    const { id } = req.params;
    // Could be favorite document ID or item ID
    const deleted = await Favorite.findOneAndDelete({
      $and: [
        { user: req.user._id },
        {
          $or: [
            { _id: id },
            { product: id },
            { farmer: id },
            { market: id },
          ],
        },
      ],
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Favorite not found' });
    }

    res.json({ success: true, message: 'Removed from favorites', data: deleted });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
