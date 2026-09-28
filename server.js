import dotenv from 'dotenv';
import http from 'http';
import app from './app.js';
import connectDB from './config/db.js';
import { initSocket } from './socket/socketServer.js';

dotenv.config();

const PORT = process.env.Port || process.env.PORT || 9000;

// Connect Database (seedAdmin runs inside connectDB)
connectDB();

// Create HTTP server and attach Socket.io
const httpServer = http.createServer(app);
initSocket(httpServer);

// Start Server
httpServer.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});
