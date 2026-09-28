import { GoogleGenAI } from '@google/genai';
import Conversation from '../models/conversationModel.js';
import Message from '../models/messageModel.js';
import AIChatHistory from '../models/aiChatHistoryModel.js';
import { getIO } from '../socket/socketServer.js';

// ─────────────────────────────────────────────
// AI CHATBOT
// ─────────────────────────────────────────────
export const sendAIMessage = async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Message is required.' });
  }
  if (message.trim().length > 1000) {
    return res.status(400).json({ success: false, message: 'Message too long.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return res.status(503).json({ success: false, message: 'AI service not configured. Please add GEMINI_API_KEY to .env' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const systemContext = `You are a helpful assistant for MarketLink, a local farmers market platform.
You help users with:
- Finding fresh organic produce and farm products
- Information about local verified farmers and their market stalls
- Pre-ordering produce before market days
- Market hub locations and pickup slots
- Order tracking and management
- Platform features and navigation
- Payment methods (cash/card at pickup)
- Return and quality guarantee policies

Important rules:
- Only answer questions related to MarketLink platform, farmers markets, organic produce, orders, and general help
- If you don't know something specific, say so honestly - do NOT make up information
- Be friendly, concise, and helpful
- For account-specific order queries, direct users to their Profile page or suggest contacting Admin support
- The platform connects customers with local farmers, no home delivery, pickup at market stalls only`;

    // Try models in order of preference — fallback on 503/UNAVAILABLE
    const modelsToTry = ['gemini-3.1-flash-lite-preview', 'gemini-3.8-flash', 'gemini-3.5-flash'];
    let response;
    let lastError;

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: `${systemContext}\n\nUser: ${message.trim()}`,
        });
        console.log(`AI response from model: ${modelName}`);
        break; // Success — stop trying
      } catch (error) {
        lastError = error;
        // @google/genai SDK embeds JSON error in error.message
        let httpCode = null;
        try {
          const parsed = JSON.parse(error.message);
          httpCode = parsed?.error?.code;
        } catch (_) {
          // not JSON — check raw string
        }
        const errStr = error?.message || '';
        const isUnavailable =
          httpCode === 503 ||
          errStr.includes('503') ||
          errStr.includes('UNAVAILABLE') ||
          errStr.includes('high demand') ||
          errStr.includes('Server Unavailable');

        if (isUnavailable) {
          console.warn(`Model ${modelName} unavailable (503), trying next...`);
          await new Promise(res => setTimeout(res, 1000));
          continue;
        }
        // Non-503 error — throw immediately
        throw error;
      }
    }

    if (!response) {
      // All models failed with 503
      return res.status(503).json({
        success: false,
        message: 'AI models are currently experiencing high demand. Please try again in a moment.'
      });
    }

    const aiResponse = response?.text || 'Sorry, I could not generate a response.';

    // Save to history only if user is logged in
    if (req.user && req.user._id) {
      await AIChatHistory.create({
        userId: req.user._id,
        userMessage: message.trim(),
        aiResponse: aiResponse,
        sessionId: sessionId || '',
      });
    }

    res.json({ success: true, response: aiResponse });
  } catch (err) {
    console.error('AI chat error:', err.message);
    res.status(500).json({ success: false, message: `AI error: ${err.message}` });
  }
};

// GET /api/chat/ai/history
export const getAIHistory = async (req, res) => {
  try {
    const history = await AIChatHistory.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('userMessage aiResponse createdAt');
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load AI history.' });
  }
};

// ─────────────────────────────────────────────
// LIVE CHAT — USER SIDE
// ─────────────────────────────────────────────

// POST /api/chat/conversations — get or create conversation for logged-in user
export const getOrCreateConversation = async (req, res) => {
  try {
    let conversation = await Conversation.findOne({
      userId: req.user._id,
      status: { $ne: 'archived' },
    }).sort({ updatedAt: -1 });

    if (!conversation) {
      conversation = await Conversation.create({ userId: req.user._id });
    }

    res.json({ success: true, conversation });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get conversation.' });
  }
};

// GET /api/chat/conversations/:id/messages
export const getMessages = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found.' });

    // Only owner or admin
    const isOwner = conversation.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const messages = await Message.find({ conversationId: req.params.id })
      .sort({ createdAt: 1 })
      .populate('senderId', 'name role profileImage');

    // Mark messages as read for the requesting user
    if (isOwner) {
      await Message.updateMany(
        { conversationId: req.params.id, senderRole: 'admin', isRead: false },
        { isRead: true }
      );
      await Conversation.findByIdAndUpdate(req.params.id, { userUnreadCount: 0 });
    } else if (isAdmin) {
      await Message.updateMany(
        { conversationId: req.params.id, senderRole: { $ne: 'admin' }, isRead: false },
        { isRead: true }
      );
      await Conversation.findByIdAndUpdate(req.params.id, { adminUnreadCount: 0 });
    }

    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load messages.' });
  }
};

// POST /api/chat/conversations/:id/messages
export const sendMessage = async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Message is required.' });
  }
  if (message.trim().length > 2000) {
    return res.status(400).json({ success: false, message: 'Message too long (max 2000 chars).' });
  }

  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found.' });

    const isOwner = conversation.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const newMessage = await Message.create({
      conversationId: conversation._id,
      senderId: req.user._id,
      senderRole: req.user.role,
      message: message.trim(),
    });

    // Update conversation meta
    const unreadUpdate = isAdmin
      ? { userUnreadCount: conversation.userUnreadCount + 1 }
      : { adminUnreadCount: conversation.adminUnreadCount + 1 };

    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: message.trim().substring(0, 100),
      lastMessageAt: new Date(),
      ...unreadUpdate,
    });

    const populatedMsg = await Message.findById(newMessage._id).populate('senderId', 'name role profileImage');

    // Emit via Socket.IO to room
    try {
      const io = getIO();
      io.to(`conv_${conversation._id}`).emit('new_message', populatedMsg);
      // Also notify admin room
      if (!isAdmin) {
        io.to('admin_room').emit('conversation_update', {
          conversationId: conversation._id,
          lastMessage: message.trim().substring(0, 100),
          adminUnreadCount: conversation.adminUnreadCount + 1,
        });
      }
    } catch (e) {
      console.error('Socket emit error:', e.message);
    }

    res.status(201).json({ success: true, message: populatedMsg });
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ success: false, message: 'Failed to send message.' });
  }
};

// ─────────────────────────────────────────────
// LIVE CHAT — ADMIN SIDE
// ─────────────────────────────────────────────

// GET /api/chat/admin/conversations
export const getAdminConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({ status: { $ne: 'archived' } })
      .populate('userId', 'name email profileImage role')
      .sort({ lastMessageAt: -1 });
    res.json({ success: true, conversations });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load conversations.' });
  }
};

// PATCH /api/chat/admin/conversations/:id/status
export const updateConversationStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['open', 'closed', 'archived'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status.' });
  }
  try {
    const conversation = await Conversation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    res.json({ success: true, conversation });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update conversation.' });
  }
};
