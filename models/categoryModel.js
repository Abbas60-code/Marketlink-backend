import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      unique: true,
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
      url: {
        type: String,
        default: '',
      },
      public_id: {
        type: String,
        default: '',
      },
    },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    position: {
      type: Number,
      default: 0,
    },
    createdBy: {
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

// Virtual for child subcategories
categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentCategory',
});

// Auto-generate slug from name if not manually provided
categorySchema.pre('save', function () {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
});

const Category = mongoose.model('Category', categorySchema);

export default Category;
