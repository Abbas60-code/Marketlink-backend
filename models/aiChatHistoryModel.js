import mongoose from 'mongoose';

const aiChatHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userMessage: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, 'Message too long'],
    },
    aiResponse: {
      type: String,
      required: true,
    },
    sessionId: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Index for fast per-user history queries
aiChatHistorySchema.index({ userId: 1, createdAt: -1 });

const AIChatHistory = mongoose.model('AIChatHistory', aiChatHistorySchema);
export default AIChatHistory;
