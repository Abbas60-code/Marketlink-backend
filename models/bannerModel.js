import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Banner title is required'],
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    image: {
      url: {
        type: String,
        required: [true, 'Banner image URL is required'],
      },
      public_id: {
        type: String,
        default: '',
      },
    },
    link: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: 'main', // e.g. 'main', 'hero', 'promo', 'offer', 'sidebar'
    },
    position: {
      type: Number,
      default: 0, // Lower number displayed first
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

const Banner = mongoose.model('Banner', bannerSchema);

export default Banner;
