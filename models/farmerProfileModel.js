import mongoose from 'mongoose';

const pickupWindowSchema = new mongoose.Schema({
  day: { type: String, required: true }, // e.g. 'Saturday', 'Sunday'
  startTime: { type: String, default: '09:00 AM' },
  endTime: { type: String, default: '01:00 PM' },
  cutoffHours: { type: Number, default: 2 }, // hours before pickup when pre-orders close
  maxOrders: { type: Number, default: 30 },
});

const farmerProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    farmName: {
      type: String,
      required: [true, 'Farm/stall name is required'],
      trim: true,
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
    },
    contactPerson: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    coverImage: {
      url: { type: String, default: '' },
      public_id: { type: String, default: '' },
    },
    profileImage: {
      url: { type: String, default: '' },
      public_id: { type: String, default: '' },
    },
    market: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Market',
    },
    stallNumber: {
      type: String,
      default: '',
    },
    operatingDays: [{
      type: String, // e.g. ['Friday', 'Saturday', 'Sunday']
    }],
    pickupWindows: [pickupWindowSchema],
    location: {
      address: { type: String, default: '' },
      city: { type: String, default: '' },
      lat: { type: Number, default: 24.8607 },
      lng: { type: Number, default: 67.0011 },
    },
    certifications: [{ type: String }], // e.g. ['Certified Organic', 'Pesticide-Free', 'Non-GMO']
    specialties: [{ type: String }], // e.g. ['Fresh Greens', 'Heirloom Tomatoes', 'Farm Eggs', 'Raw Honey']
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isVerifiedFarmer: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

farmerProfileSchema.pre('save', function () {
  if (this.isModified('farmName') || !this.slug) {
    this.slug = this.farmName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
});

const FarmerProfile = mongoose.model('FarmerProfile', farmerProfileSchema);
export default FarmerProfile;
