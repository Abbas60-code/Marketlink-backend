import User from '../models/userModel.js';
import FarmerProfile from '../models/farmerProfileModel.js';
import Market from '../models/marketModel.js';
import Product from '../models/productModel.js';
import Order from '../models/orderModel.js';
import Review from '../models/reviewModel.js';

// @desc    Get real Admin Dashboard KPIs and summary
// @route   GET /api/admin/dashboard-stats
// @access  Private/Admin
export const getAdminDashboardStats = async (req, res) => {
  try {
    const totalCustomers = await User.countDocuments({ role: 'user' });
    const totalFarmers = await FarmerProfile.countDocuments();
    const totalMarkets = await Market.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalProducts = await Product.countDocuments();

    // Real revenue calculation (completed / confirmed pre-orders)
    const completedOrders = await Order.find({ status: { $in: ['Completed', 'completed', 'Ready for Pickup', 'ready'] } });
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const pendingOrdersCount = await Order.countDocuments({ status: { $in: ['Placed', 'pending'] } });

    // Recent orders
    const recentOrders = await Order.find()
      .populate('customer', 'name email')
      .populate('market', 'name')
      .sort({ createdAt: -1 })
      .limit(6);

    // Orders by market
    const ordersByMarket = await Order.aggregate([
      { $group: { _id: '$marketName', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]);

    // Active farmers count
    const activeFarmersCount = await FarmerProfile.countDocuments({ isActive: true });

    res.json({
      success: true,
      data: {
        totalCustomers,
        totalFarmers,
        activeFarmersCount,
        totalMarkets,
        totalOrders,
        totalProducts,
        totalRevenue,
        pendingOrdersCount,
        recentOrders,
        ordersByMarket,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all registered customers (Admin)
// @route   GET /api/admin/customers
// @access  Private/Admin
export const getAdminCustomers = async (req, res) => {
  try {
    const { search, isActive, page = 1, limit = 20 } = req.query;
    let query = { role: 'user' };

    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search && search.trim()) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(safeSearch, 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { address: searchRegex },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await User.countDocuments(query);
    const customers = await User.find(query)
      .select('-password -otp -otpExpires')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({ success: true, count: customers.length, total, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle Customer active status
// @route   PATCH /api/admin/customers/:id/status
// @access  Private/Admin
export const updateCustomerStatus = async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Customer not found' });

    user.isActive = Boolean(isActive);
    await user.save();

    res.json({
      success: true,
      message: `Customer account is now ${user.isActive ? 'Active' : 'Deactivated'}`,
      data: { _id: user._id, name: user.name, email: user.email, isActive: user.isActive },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Moderate / Toggle Product status (Admin)
// @route   PATCH /api/admin/products/:id/status
// @access  Private/Admin
export const updateProductStatus = async (req, res) => {
  try {
    const { isAvailable, isFeatured } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (isAvailable !== undefined) product.isAvailable = Boolean(isAvailable);
    if (isFeatured !== undefined) product.isFeatured = Boolean(isFeatured);

    await product.save();

    res.json({
      success: true,
      message: 'Product moderation updated',
      data: product,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Generate comprehensive Admin reports with real data
// @route   GET /api/admin/reports
// @access  Private/Admin
export const getAdminReports = async (req, res) => {
  try {
    const { market, startDate, endDate } = req.query;

    let matchQuery = {};
    if (market) matchQuery.market = market;
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    // Orders and Revenue breakdown
    const orderBreakdown = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
        },
      },
    ]);

    // Market summary
    const marketReport = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$marketName',
          ordersCount: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          avgOrderValue: { $avg: '$totalAmount' },
        },
      },
      { $sort: { ordersCount: -1 } },
    ]);

    // Top Selling Farmers
    const topFarmers = await FarmerProfile.find({ isActive: true })
      .populate('user', 'name email')
      .populate('market', 'name')
      .sort({ rating: -1, reviewCount: -1 })
      .limit(10);

    // Top Selling Products
    const topProducts = await Product.find({ isAvailable: true })
      .populate('category', 'name')
      .populate('farmer', 'farmName')
      .sort({ rating: -1, stock: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        orderBreakdown,
        marketReport,
        topFarmers,
        topProducts,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
