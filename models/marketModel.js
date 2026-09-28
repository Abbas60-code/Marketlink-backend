import mongoose from 'mongoose';

const marketSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Market name is required'],
      trim: true,
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    image: {
      url: { type: String, default: '' },
      public_id: { type: String, default: '' },
    },
    location: {
      address: { type: String, default: '' },
      city: { type: String, default: '' },
      coordinates: {
        lat: { type: Number },
        lng: { type: Number },
      },
    },
    marketDays: [{ type: String }], // e.g. ['Saturday', 'Sunday']
    openTime: { type: String, default: '' }, // e.g. '8:00 AM'
    closeTime: { type: String, default: '' }, // e.g. '2:00 PM'
    pickupStartTime: { type: String, default: '' },
    pickupEndTime: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    managedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Auto-generate slug
marketSchema.pre('save', function () {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
});

const Market = mongoose.model('Market', marketSchema);
export default Market;
