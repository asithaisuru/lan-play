import express from 'express';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { networkInterfaces } from 'os'; // Import from 'os' directly

import { initializePlaylistSocket } from './sockets/playlistSocket.js';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'LAN Play Server is running' });
});

// Network info endpoint
app.get('/api/network-info', (req, res) => {
  const interfaces = networkInterfaces();
  const networkIPs = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        networkIPs.push(net.address);
      }
    }
  }
  
  res.json({
    networkIPs,
    serverIP: req.socket.localAddress,
    clientIP: req.ip,
    yourNetworkURL: networkIPs.length > 0 ? `http://${networkIPs[0]}:3000` : null
  });
});

// Initialize sockets
initializePlaylistSocket(io);

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lan-play')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// Get local IP address
function getLocalIP() {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();

server.listen(PORT, HOST, () => {
  console.log(`LAN Play Server running on port ${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log(`Network access: http://${localIP}:${PORT}`);
});