import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['order_status', 'new_order', 'announcement', 'stock_alert', 'system'],
      default: 'order_status',
    },
    link: {
      type: String,
      default: '',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    metadata: {
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    },
  },
  {
    timestamps: true,
  }
);

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
