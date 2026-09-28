import mongoose from 'mongoose';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import FarmerProfile from '../models/farmerProfileModel.js';
import Market from '../models/marketModel.js';
import User from '../models/userModel.js';
import { createNotificationHelper } from './notificationController.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


// Canonical status map
const normalizeStatus = (status) => {
  const map = {
    pending: 'Placed',
    placed: 'Placed',
    confirmed: 'Accepted',
    accepted: 'Accepted',
    ready: 'Ready for Pickup',
    'ready for pickup': 'Ready for Pickup',
    completed: 'Completed',
    cancelled: 'Cancelled',
    declined: 'Declined',
  };
  return map[status?.toLowerCase()] || status;
};

// @desc    Create Stripe Payment Intent
// @route   POST /api/orders/create-payment-intent
// @access  Private/Customer
export const createPaymentIntent = async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // convert to smallest currency unit (e.g., paise/cents)
      currency: 'pkr',
      metadata: { userId: req.user._id.toString() }
    });

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('Stripe Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Place a new pre-order (Customer)
// @route   POST /api/orders
// @access  Private/Customer
export const placeOrder = async (req, res) => {
  try {
    const { market, items, pickupDate, pickupTimeSlot, customerNote } = req.body;

    if (!market || !items || !Array.isArray(items) || items.length === 0 || !pickupDate || !pickupTimeSlot) {
      return res.status(400).json({
        success: false,
        message: 'Market, items, pickup date, and pickup time slot are required for in-person pickup.',
      });
    }

    const marketDoc = await Market.findById(market);
    if (!marketDoc) {
      return res.status(404).json({ success: false, message: 'Selected Farmers Market not found' });
    }

    let totalAmount = 0;
    const orderItems = [];
    const affectedFarmers = new Set();

    // Validate every item's stock before deducting
    for (const item of items) {
      const productId = item.productId || item.product || item._id;
      const quantity = Number(item.quantity);

      if (!productId || !quantity || quantity < 1) {
        return res.status(400).json({ success: false, message: 'Invalid product or quantity in cart' });
      }

      const product = await Product.findById(productId).populate('farmer');

      if (!product) {
        return res.status(404).json({ success: false, message: `Product not found` });
      }

      if (!product.isAvailable) {
        return res.status(400).json({
          success: false,
          message: `"${product.name}" is currently marked unavailable by the farmer.`,
        });
      }

      if (product.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Only ${product.stock} ${product.unit} available.`,
        });
      }

      const subtotal = product.price * quantity;
      totalAmount += subtotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.images?.[0]?.url || '',
        price: product.price,
        unit: product.unit || 'kg',
        quantity,
        subtotal,
        farmer: product.farmer?._id,
        farmerName: product.farmer?.farmName || 'Local Farm Stall',
      });

      if (product.farmer) {
        affectedFarmers.add(product.farmer);
      }

      // Deduct available stock
      product.stock -= quantity;
      await product.save();
    }

    // Set cancellation cutoff (e.g. 2 hours before pickup date)
    const pDate = new Date(pickupDate);
    const cancellationCutoff = new Date(pDate.getTime() - 2 * 60 * 60 * 1000);

    const order = await Order.create({
      customer: req.user._id,
      market: marketDoc._id,
      marketName: marketDoc.name,
      items: orderItems,
      totalAmount,
      pickupDate: pDate,
      pickupTimeSlot,
      status: 'Placed',
      paymentMethod: 'In-Person at Pickup (Cash / Card)',
      paymentStatus: 'Pending',
      customerNote: customerNote || '',
      cancellationCutoff,
    });

    const populatedOrder = await Order.findById(order._id)
      .populate('market', 'name location marketDays')
      .populate('customer', 'name email phone');

    // Send in-app notification to Customer
    await createNotificationHelper({
      recipient: req.user._id,
      title: 'Pre-Order Placed Successfully',
      message: `Your pre-order #${populatedOrder.orderNumber} for ${marketDoc.name} on ${pDate.toLocaleDateString()} (${pickupTimeSlot}) has been placed. Payment is settled in-person at pickup.`,
      type: 'order_status',
      link: `/profile?tab=orders`,
      metadata: { orderId: order._id },
    });

    // Send notification to each Farmer involved
    for (const farmer of affectedFarmers) {
      if (farmer.user) {
        await createNotificationHelper({
          recipient: farmer.user,
          title: 'New Produce Pre-Order Received',
          message: `Order #${populatedOrder.orderNumber} has been placed for pickup on ${pDate.toLocaleDateString()} (${pickupTimeSlot}).`,
          type: 'new_order',
          link: `/farmer-dashboard?tab=orders`,
          metadata: { orderId: order._id },
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Pre-order placed successfully! Please collect and pay in-person during your selected pickup slot.',
      data: populatedOrder,
    });
  } catch (error) {
    console.error('Place Order Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get logged in customer's order history
// @route   GET /api/orders/my-orders
// @access  Private/Customer
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .populate('market', 'name location marketDays openTime closeTime')
      .populate('items.farmer', 'farmName stallNumber phone')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single order details
// @route   GET /api/orders/:id
// @access  Private (Customer own, Farmer of item, or Admin)
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('market', 'name location marketDays openTime closeTime')
      .populate('customer', 'name email phone address')
      .populate('items.farmer', 'farmName stallNumber phone location');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Authorization check
    if (req.user.role === 'admin') {
      return res.json({ success: true, data: order });
    }

    if (order.customer._id.toString() === req.user._id.toString()) {
      return res.json({ success: true, data: order });
    }

    // Check if logged-in user is a farmer whose products are in this order
    const farmerProfile = await FarmerProfile.findOne({ user: req.user._id });
    if (farmerProfile) {
      const isFarmerInOrder = order.items.some(
        (item) => item.farmer && item.farmer._id.toString() === farmerProfile._id.toString()
      );
      if (isFarmerInOrder) {
        return res.json({ success: true, data: order });
      }
    }

    return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Cancel order before cutoff time (Customer)
// @route   PATCH /api/orders/:id/cancel
// @access  Private/Customer
export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.customer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this order' });
    }

    const currentNormStatus = normalizeStatus(order.status);
    if (['Completed', 'Cancelled', 'Declined'].includes(currentNormStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel an order that is already ${currentNormStatus}.`,
      });
    }

    // Check cutoff time (if set and date has passed)
    if (order.cancellationCutoff && new Date() > new Date(order.cancellationCutoff)) {
      return res.status(400).json({
        success: false,
        message: 'The cancellation cutoff window for this order has passed (must cancel at least 2 hours before pickup).',
      });
    }

    // Restore stock
    for (const item of order.items) {
      if (item.product) {
        await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
      }
    }

    order.status = 'Cancelled';
    order.cancelReason = req.body.reason || 'Cancelled by customer';
    await order.save();

    // In-app notification to customer
    await createNotificationHelper({
      recipient: order.customer,
      title: 'Order Cancelled',
      message: `Your pre-order #${order.orderNumber} has been cancelled and stock has been restored.`,
      type: 'order_status',
      link: `/profile?tab=orders`,
      metadata: { orderId: order._id },
    });

    res.json({ success: true, message: 'Order cancelled successfully', data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reorder items from a past order (Customer)
// @route   POST /api/orders/:id/reorder
// @access  Private/Customer
export const reorderOrder = async (req, res) => {
  try {
    const prevOrder = await Order.findById(req.params.id);
    if (!prevOrder) return res.status(404).json({ success: false, message: 'Previous order not found' });

    if (prevOrder.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Check stock for all items
    const reorderItems = [];
    for (const item of prevOrder.items) {
      const product = await Product.findById(item.product);
      if (product && product.isAvailable && product.stock >= item.quantity) {
        reorderItems.push({
          productId: product._id,
          name: product.name,
          price: product.price,
          quantity: item.quantity,
          unit: product.unit,
          stock: product.stock,
          image: product.images?.[0]?.url || '',
        });
      }
    }

    if (reorderItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'None of the items from this previous order are currently in stock.',
      });
    }

    res.json({
      success: true,
      message: `${reorderItems.length} items available to add to cart`,
      data: {
        market: prevOrder.market,
        items: reorderItems,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get orders for Farmer dashboard
// @route   GET /api/orders/farmer-orders
// @access  Private/Farmer
export const getFarmerOrders = async (req, res) => {
  try {
    const farmerProfile = await FarmerProfile.findOne({ user: req.user._id });
    if (!farmerProfile) {
      return res.status(404).json({ success: false, message: 'Farmer profile not found' });
    }

    const { status, search } = req.query;

    // Find orders containing this farmer's products
    let query = { 'items.farmer': farmerProfile._id };

    if (status) {
      const norm = normalizeStatus(status);
      query.$or = [{ status: norm }, { status: status.toLowerCase() }];
    }

    if (search && search.trim()) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(safeSearch, 'i');
      const matchingUsers = await User.find({
        $or: [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }]
      }).select('_id');

      const searchConditions = [
        { orderNumber: searchRegex },
        { 'items.name': searchRegex },
        { marketName: searchRegex },
      ];
      if (matchingUsers.length > 0) {
        searchConditions.push({ customer: { $in: matchingUsers.map(u => u._id) } });
      }

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    const orders = await Order.find(query)
      .populate('customer', 'name email phone address')
      .populate('market', 'name location marketDays')
      .sort({ createdAt: -1 });

    // Format for farmer view with filtered items
    const farmerOrders = orders.map((order) => {
      const myItems = order.items.filter(
        (item) => item.farmer && item.farmer.toString() === farmerProfile._id.toString()
      );
      const farmerSubtotal = myItems.reduce((sum, item) => sum + item.subtotal, 0);

      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        customer: order.customer,
        market: order.market,
        marketName: order.marketName,
        items: myItems,
        allOrderItemsCount: order.items.length,
        farmerSubtotal,
        totalAmount: order.totalAmount,
        pickupDate: order.pickupDate,
        pickupTimeSlot: order.pickupTimeSlot,
        status: normalizeStatus(order.status),
        rawStatus: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        customerNote: order.customerNote,
        createdAt: order.createdAt,
      };
    });

    res.json({ success: true, count: farmerOrders.length, data: farmerOrders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update order status (Farmer or Admin)
// @route   PATCH /api/orders/:id/status
// @access  Private/Farmer or Admin
export const updateOrderStatus = async (req, res) => {
  try {
    const { status, cancelReason } = req.body;
    const validStatuses = ['Placed', 'Accepted', 'Ready for Pickup', 'Completed', 'Cancelled', 'Declined'];
    const normStatus = normalizeStatus(status);

    if (!validStatuses.includes(normStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email')
      .populate('market', 'name');

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Authorization check for Farmer
    if (req.user.role !== 'admin') {
      const farmerProfile = await FarmerProfile.findOne({ user: req.user._id });
      if (!farmerProfile) return res.status(403).json({ success: false, message: 'Farmer profile not found' });

      const hasFarmerItem = order.items.some(
        (item) => item.farmer && item.farmer.toString() === farmerProfile._id.toString()
      );
      if (!hasFarmerItem) {
        return res.status(403).json({ success: false, message: 'Not authorized to update this order' });
      }
    }

    const oldStatus = normalizeStatus(order.status);

    // If changing to Cancelled or Declined from an active status, restore stock
    if (['Cancelled', 'Declined'].includes(normStatus) && !['Cancelled', 'Declined'].includes(oldStatus)) {
      for (const item of order.items) {
        if (item.product) {
          await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
        }
      }
    }

    // If changing to Completed, mark payment as Paid (since customer paid in-person at pickup)
    if (normStatus === 'Completed') {
      order.paymentStatus = 'Paid';
    }

    order.status = normStatus;
    if (cancelReason) order.cancelReason = cancelReason;
    await order.save();

    // Send customer notification
    const statusMessages = {
      Accepted: `Your pre-order #${order.orderNumber} has been accepted by the farmer. See you on ${new Date(order.pickupDate).toLocaleDateString()}!`,
      'Ready for Pickup': `Your pre-order #${order.orderNumber} is packed and ready for pickup at ${order.marketName || 'the market'} during ${order.pickupTimeSlot}.`,
      Completed: `Your pre-order #${order.orderNumber} has been completed. Thank you for supporting local organic agriculture! You can now rate and review your produce.`,
      Declined: `Your pre-order #${order.orderNumber} was declined by the farmer. Reason: ${cancelReason || 'Out of stock'}. Any reserved stock has been returned.`,
      Cancelled: `Order #${order.orderNumber} was marked cancelled.`,
    };

    if (statusMessages[normStatus]) {
      await createNotificationHelper({
        recipient: order.customer._id,
        title: `Order Status: ${normStatus}`,
        message: statusMessages[normStatus],
        type: 'order_status',
        link: `/profile?tab=orders`,
        metadata: { orderId: order._id },
      });
    }

    res.json({
      success: true,
      message: `Order status updated to "${normStatus}"`,
      data: order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get real farmer dashboard stats
// @route   GET /api/orders/farmer-stats
// @access  Private/Farmer
export const getFarmerStats = async (req, res) => {
  try {
    const farmerProfile = await FarmerProfile.findOne({ user: req.user._id });
    if (!farmerProfile) return res.status(404).json({ success: false, message: 'Farmer profile not found' });

    const orders = await Order.find({ 'items.farmer': farmerProfile._id }).sort({ createdAt: -1 });

    let totalOrders = orders.length;
    let pendingOrders = 0;
    let acceptedOrders = 0;
    let readyOrders = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;
    let totalRevenue = 0;

    const productSalesMap = {};

    orders.forEach((order) => {
      const norm = normalizeStatus(order.status);
      if (norm === 'Placed') pendingOrders++;
      else if (norm === 'Accepted') acceptedOrders++;
      else if (norm === 'Ready for Pickup') readyOrders++;
      else if (norm === 'Completed') completedOrders++;
      else if (['Cancelled', 'Declined'].includes(norm)) cancelledOrders++;

      const myItems = order.items.filter(
        (item) => item.farmer && item.farmer.toString() === farmerProfile._id.toString()
      );

      myItems.forEach((item) => {
        if (norm === 'Completed') {
          totalRevenue += item.subtotal;
        }
        const pId = item.product?.toString() || item.name;
        if (!productSalesMap[pId]) {
          productSalesMap[pId] = { name: item.name, quantity: 0, revenue: 0, image: item.image };
        }
        productSalesMap[pId].quantity += item.quantity;
        productSalesMap[pId].revenue += item.subtotal;
      });
    });

    const bestSellers = Object.values(productSalesMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        totalOrders,
        pendingOrders,
        acceptedOrders,
        readyOrders,
        completedOrders,
        cancelledOrders,
        totalRevenue,
        bestSellers,
        recentOrders: orders.slice(0, 6),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all orders (Admin)
// @route   GET /api/orders
// @access  Private/Admin
export const getAllOrders = async (req, res) => {
  try {
    const { status, market, search, page = 1, limit = 20 } = req.query;
    let query = {};
    if (status) {
      const norm = normalizeStatus(status);
      query.$or = [{ status: norm }, { status: status.toLowerCase() }];
    }
    if (market) query.market = market;

    if (search && search.trim()) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(safeSearch, 'i');
      const matchingUsers = await User.find({
        $or: [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }]
      }).select('_id');

      const searchConditions = [
        { orderNumber: searchRegex },
        { 'items.name': searchRegex },
        { marketName: searchRegex },
      ];
      if (matchingUsers.length > 0) {
        searchConditions.push({ customer: { $in: matchingUsers.map(u => u._id) } });
      }

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate('market', 'name location')
      .populate('customer', 'name email phone')
      .populate('items.farmer', 'farmName stallNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({ success: true, count: orders.length, total, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get admin dashboard stats from real database
// @route   GET /api/orders/stats
// @access  Private/Admin
export const getOrderStats = async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const placedOrders = await Order.countDocuments({ status: { $in: ['Placed', 'pending'] } });
    const acceptedOrders = await Order.countDocuments({ status: { $in: ['Accepted', 'confirmed'] } });
    const readyOrders = await Order.countDocuments({ status: { $in: ['Ready for Pickup', 'ready'] } });
    const completedOrders = await Order.countDocuments({ status: { $in: ['Completed', 'completed'] } });
    const cancelledOrders = await Order.countDocuments({ status: { $in: ['Cancelled', 'cancelled', 'Declined', 'declined'] } });

    const completedDocs = await Order.find({ status: { $in: ['Completed', 'completed'] } });
    const totalRevenue = completedDocs.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    // Orders by market
    const ordersByMarket = await Order.aggregate([
      { $group: { _id: '$marketName', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        totalOrders,
        pendingOrders: placedOrders,
        acceptedOrders,
        readyOrders,
        completedOrders,
        cancelledOrders,
        totalRevenue,
        ordersByMarket,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
