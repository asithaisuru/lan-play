import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { networkInterfaces } from 'os'; // Import from 'os' directly

import { initializePlaylistSocket } from './sockets/playlistSocket.js';

dotenv.config();

const VIRTUAL_INTERFACE_PATTERN = /(virtual|vmware|vbox|virtualbox|hyper-v|vethernet|docker|wsl|loopback|teredo|tap|tunnel|vpn|npcap)/i;
const PREFERRED_INTERFACE_PATTERN = /(wi-?fi|wireless|wlan|ethernet|local area connection)/i;
const FRONTEND_PORT = process.env.FRONTEND_PORT || 5173;

function getNetworkCandidates() {
  const interfaces = networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family !== 'IPv4' || net.internal) continue;

      const isVirtual = VIRTUAL_INTERFACE_PATTERN.test(name);
      const isPreferred = PREFERRED_INTERFACE_PATTERN.test(name);

      candidates.push({
        name,
        address: net.address,
        netmask: net.netmask,
        mac: net.mac,
        cidr: net.cidr,
        isVirtual,
        isPreferred,
        score: (isPreferred ? 100 : 0) - (isVirtual ? 1000 : 0)
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function getPrimaryNetworkInfo() {
  const candidates = getNetworkCandidates();
  const primary = candidates.find((candidate) => !candidate.isVirtual) || candidates[0] || null;

  return {
    primary,
    candidates,
    networkIPs: candidates
      .filter((candidate) => !candidate.isVirtual)
      .map((candidate) => candidate.address)
  };
}

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
  const { primary, candidates, networkIPs } = getPrimaryNetworkInfo();
  
  res.json({
    networkIPs,
    primaryIP: primary?.address || null,
    primaryInterface: primary?.name || null,
    interfaces: candidates,
    serverIP: req.socket.localAddress,
    clientIP: req.ip,
    yourNetworkURL: primary ? `http://${primary.address}:${FRONTEND_PORT}` : null
  });
});

// Initialize sockets
initializePlaylistSocket(io);

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// Get local IP address
function getLocalIP() {
  return getPrimaryNetworkInfo().primary?.address || 'localhost';
}

const localIP = getLocalIP();

server.listen(PORT, HOST, () => {
  console.log(`LAN Play Server running on port ${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log(`Network access: http://${localIP}:${PORT}`);
});
