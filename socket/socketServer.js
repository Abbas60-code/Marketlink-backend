import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'techwiz_secret');
      socket.user = decoded; // { id, role, ... }
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (User: ${socket.user.id}, Role: ${socket.user.role})`);

    // Admins join a special admin room for global updates
    if (socket.user.role === 'admin') {
      socket.join('admin_room');
      console.log(`Socket ${socket.id} joined admin_room`);
    }

    // Join a specific conversation room
    socket.on('join_conversation', (conversationId) => {
      const room = `conv_${conversationId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined room: ${room}`);
    });

    // Leave a specific conversation room
    socket.on('leave_conversation', (conversationId) => {
      const room = `conv_${conversationId}`;
      socket.leave(room);
      console.log(`Socket ${socket.id} left room: ${room}`);
    });

    // Typing indicators
    socket.on('typing_start', ({ conversationId }) => {
      socket.to(`conv_${conversationId}`).emit('typing_start', { senderId: socket.user.id });
    });

    socket.on('typing_end', ({ conversationId }) => {
      socket.to(`conv_${conversationId}`).emit('typing_end', { senderId: socket.user.id });
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  console.log('Socket.io initialized with Auth');
  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initSocket(server) first.');
  }
  return io;
};

