import mongoose from 'mongoose';

const favoriteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    itemType: {
      type: String,
      enum: ['product', 'farmer', 'market'],
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FarmerProfile',
    },
    market: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Market',
    },
  },
  {
    timestamps: true,
  }
);

// Ensure a user cannot duplicate favorite the same item
favoriteSchema.index({ user: 1, itemType: 1, product: 1, farmer: 1, market: 1 }, { unique: true });

const Favorite = mongoose.model('Favorite', favoriteSchema);
export default Favorite;
