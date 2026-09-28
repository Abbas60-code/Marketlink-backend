import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: { type: String, required: true },
  image: { type: String, default: '' },
  price: { type: Number, required: true },
  unit: { type: String, default: 'kg' },
  quantity: { type: Number, required: true, min: 1 },
  subtotal: { type: Number, required: true },
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FarmerProfile',
  },
  farmerName: { type: String, default: '' },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    market: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Market',
      required: true,
    },
    marketName: { type: String, default: '' },
    items: [orderItemSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    pickupDate: {
      type: Date,
      required: true,
    },
    pickupTimeSlot: {
      type: String,
      required: true, // e.g. '09:00 AM - 11:00 AM'
    },
    status: {
      type: String,
      enum: [
        'Placed', 'Accepted', 'Ready for Pickup', 'Completed', 'Cancelled', 'Declined',
        'pending', 'confirmed', 'ready', 'completed', 'cancelled', 'declined'
      ],
      default: 'Placed',
    },
    paymentMethod: {
      type: String,
      default: 'In-Person at Pickup (Cash / Card)',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'Pending', 'Paid'],
      default: 'Pending',
    },
    customerNote: { type: String, default: '' },
    cancelReason: { type: String, default: '' },
    cancellationCutoff: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate order number and cancellation cutoff before save
orderSchema.pre('save', async function () {
  if (!this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `ML-${String(count + 1).padStart(5, '0')}`;
  }
  if (!this.cancellationCutoff && this.pickupDate) {
    // Default cutoff: 2 hours before pickup date/time
    this.cancellationCutoff = new Date(new Date(this.pickupDate).getTime() - 2 * 60 * 60 * 1000);
  }
});

const Order = mongoose.model('Order', orderSchema);
export default Order;
