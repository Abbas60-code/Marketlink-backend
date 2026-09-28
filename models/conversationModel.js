import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['open', 'closed', 'archived'],
      default: 'open',
    },
    subject: {
      type: String,
      default: 'Support Chat',
      trim: true,
    },
    lastMessage: {
      type: String,
      default: '',
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    userUnreadCount: {
      type: Number,
      default: 0,
    },
    adminUnreadCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;
