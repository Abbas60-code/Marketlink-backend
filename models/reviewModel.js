import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FarmerProfile',
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    rating: {
      type: Number,
      required: [true, 'Please provide a rating between 1 and 5'],
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: [true, 'Please provide a review comment'],
      trim: true,
    },
    reply: {
      comment: { type: String, default: '' },
      repliedAt: { type: Date },
    },
    isApproved: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Review = mongoose.model('Review', reviewSchema);
export default Review;
