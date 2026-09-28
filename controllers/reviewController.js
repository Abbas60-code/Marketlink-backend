import Review from '../models/reviewModel.js';
import Product from '../models/productModel.js';
import FarmerProfile from '../models/farmerProfileModel.js';
import Order from '../models/orderModel.js';

// @desc    Create a new review (Customer - ONLY after order is completed)
// @route   POST /api/reviews
// @access  Private/Customer
export const createReview = async (req, res) => {
  try {
    const { farmerId, productId, orderId, rating, comment } = req.body;

    if (!rating || !comment) {
      return res.status(400).json({ success: false, message: 'Please provide rating and review comment' });
    }

    if (Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5 stars' });
    }

    // Enforce SRS rule: Verify customer has a completed order
    let completedOrder = null;

    if (orderId) {
      completedOrder = await Order.findOne({
        _id: orderId,
        customer: req.user._id,
        status: { $in: ['Completed', 'completed'] },
      });
    } else {
      // Find any completed order by this customer with this product or farmer
      const query = {
        customer: req.user._id,
        status: { $in: ['Completed', 'completed'] },
      };
      if (productId) query['items.product'] = productId;
      if (farmerId) query['items.farmer'] = farmerId;

      completedOrder = await Order.findOne(query);
    }

    if (!completedOrder && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Reviews are only permitted after you have received and completed an order for this produce or farm.',
      });
    }

    // Check if customer already reviewed this specific order
    if (orderId) {
      const existing = await Review.findOne({ customer: req.user._id, order: orderId, product: productId });
      if (existing) {
        return res.status(400).json({ success: false, message: 'You have already submitted a review for this order item.' });
      }
    }

    const review = await Review.create({
      customer: req.user._id,
      farmer: farmerId || undefined,
      product: productId || undefined,
      order: completedOrder ? completedOrder._id : undefined,
      rating: Number(rating),
      comment: comment.trim(),
    });

    // Update Product average rating if product is reviewed
    if (productId) {
      const stats = await Review.aggregate([
        { $match: { product: review.product, isApproved: true } },
        { $group: { _id: '$product', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]);
      if (stats.length > 0) {
        await Product.findByIdAndUpdate(productId, {
          rating: Math.round(stats[0].avgRating * 10) / 10,
          reviewCount: stats[0].count,
        });
      }
    }

    // Update Farmer average rating if farmer is reviewed
    if (farmerId) {
      const stats = await Review.aggregate([
        { $match: { farmer: review.farmer, isApproved: true } },
        { $group: { _id: '$farmer', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]);
      if (stats.length > 0) {
        await FarmerProfile.findByIdAndUpdate(farmerId, {
          rating: Math.round(stats[0].avgRating * 10) / 10,
          reviewCount: stats[0].count,
        });
      }
    }

    const populated = await Review.findById(review._id)
      .populate('customer', 'name profileImage')
      .populate('product', 'name')
      .populate('farmer', 'farmName');

    res.status(201).json({ success: true, message: 'Thank you! Your verified review has been submitted.', data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get reviews for a farmer
// @route   GET /api/reviews/farmer/:farmerId
// @access  Public
export const getFarmerReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ farmer: req.params.farmerId, isApproved: true })
      .populate('customer', 'name profileImage')
      .populate('product', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: reviews.length, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get reviews for a product
// @route   GET /api/reviews/product/:productId
// @access  Public
export const getProductReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId, isApproved: true })
      .populate('customer', 'name profileImage')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: reviews.length, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Farmer reply to a review
// @route   POST /api/reviews/:id/reply
// @access  Private/Farmer or Admin
export const replyToReview = async (req, res) => {
  try {
    const { comment } = req.body;
    if (!comment) return res.status(400).json({ success: false, message: 'Reply comment is required' });

    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    review.reply = {
      comment: comment.trim(),
      repliedAt: new Date(),
    };
    await review.save();

    const populated = await Review.findById(review._id)
      .populate('customer', 'name profileImage')
      .populate('product', 'name')
      .populate('farmer', 'farmName');

    res.json({ success: true, message: 'Reply added successfully', data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all reviews for Admin moderation
// @route   GET /api/reviews/admin
// @access  Private/Admin
export const getAllReviewsAdmin = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('customer', 'name email')
      .populate('farmer', 'farmName')
      .populate('product', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: reviews.length, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle review approval / moderate (Admin)
// @route   PATCH /api/reviews/:id/moderate
// @access  Private/Admin
export const moderateReview = async (req, res) => {
  try {
    const { isApproved } = req.body;
    const review = await Review.findByIdAndUpdate(req.params.id, { isApproved }, { new: true });
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    res.json({ success: true, message: `Review visibility set to ${isApproved ? 'Approved' : 'Hidden'}`, data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete review (Admin)
// @route   DELETE /api/reviews/:id
// @access  Private/Admin
export const deleteReview = async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Review removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
