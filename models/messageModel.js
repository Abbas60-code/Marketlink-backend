import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderRole: {
      type: String,
      enum: ['user', 'admin', 'farmer'],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: [2000, 'Message too long'],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Message = mongoose.model('Message', messageSchema);
export default Message;
