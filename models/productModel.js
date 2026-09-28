import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
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
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    unit: {
      type: String,
      default: 'kg', // e.g. 'kg', '500g', 'bunch', 'piece', 'dozen', 'box'
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    weeklyStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    harvestDay: {
      type: String,
      default: '', // e.g. 'Friday Morning Harvest'
    },
    images: [
      {
        url: { type: String, default: '' },
        public_id: { type: String, default: '' },
      },
    ],
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FarmerProfile',
      required: true,
    },
    market: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Market',
    },
    isOrganic: { type: Boolean, default: true },
    isAvailable: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    tags: [{ type: String }],
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Auto-generate slug
productSchema.pre('save', async function () {
  if (this.isModified('name') || !this.slug) {
    let slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    // Ensure uniqueness
    const count = await mongoose.model('Product').countDocuments({ slug: new RegExp(`^${slug}(-\\d+)?$`) });
    this.slug = count > 0 ? `${slug}-${Date.now()}` : slug;
  }
});

const Product = mongoose.model('Product', productSchema);
export default Product;
