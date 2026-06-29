import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { networkInterfaces } from 'os'; // Import from 'os' directly
import cookieParser from 'cookie-parser';
import passport from 'passport';
import authRouter from './routes/auth.js';
import communityPlaylistsRouter from './routes/communityPlaylists.js';
import roomsRouter from './routes/rooms.js';
import youtubeRouter from './routes/youtube.js';

dotenv.config();

const dbMode = process.env.DB_MODE || 'sqlite';
let initializePlaylistSocket;

if (dbMode === 'postgres') {
  const mod = await import('./sockets/playlistSocketCloud.js');
  initializePlaylistSocket = mod.initializePlaylistSocket;
  console.log('Database mode: PostgreSQL (Cloud)');
} else {
  const mod = await import('./sockets/playlistSocket.js');
  initializePlaylistSocket = mod.initializePlaylistSocket;
  console.log('Database mode: SQLite (LAN)');
}

const VIRTUAL_INTERFACE_PATTERN = /(virtual|vmware|vbox|virtualbox|hyper-v|vethernet|docker|wsl|loopback|teredo|tap|tunnel|vpn|npcap)/i;
const PREFERRED_INTERFACE_PATTERN = /(wi-?fi|wireless|wlan|ethernet|local area connection)/i;
const FRONTEND_PORT = process.env.FRONTEND_PORT || 5173;
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'https://waveio.app',
  'https://www.waveio.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://localhost:3000'
];
const socketAdapterStatus = {
  name: 'memory',
  redis: false,
  required: dbMode === 'postgres',
  urlConfigured: Boolean(process.env.REDIS_URL),
  warning: null
};
const redisClients = [];

async function configureSocketAdapter(io) {
  if (dbMode !== 'postgres') {
    console.log('Socket adapter: In-memory (LAN)');
    return;
  }

  const redisUrl = process.env.REDIS_URL;
  const allowInMemoryFallback = process.env.ALLOW_IN_MEMORY_SOCKET_ADAPTER === 'true';

  if (!redisUrl) {
    const message = 'REDIS_URL is required for Waveio Cloud live Socket.IO sync.';
    if (!allowInMemoryFallback) {
      throw new Error(`${message} Set REDIS_URL or ALLOW_IN_MEMORY_SOCKET_ADAPTER=true for a temporary fallback.`);
    }

    socketAdapterStatus.warning = `${message} Using in-memory adapter because fallback is enabled.`;
    console.warn(`Socket adapter: In-memory fallback (Cloud). ${socketAdapterStatus.warning}`);
    return;
  }

  const [{ createAdapter }, { createClient }] = await Promise.all([
    import('@socket.io/redis-adapter'),
    import('redis')
  ]);

  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();

  pubClient.on('error', (error) => {
    console.error('Redis pub client error:', error);
  });
  subClient.on('error', (error) => {
    console.error('Redis sub client error:', error);
  });

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  redisClients.push(pubClient, subClient);

  socketAdapterStatus.name = 'redis';
  socketAdapterStatus.redis = true;
  socketAdapterStatus.warning = null;
  console.log('Socket adapter: Redis (Cloud)');
}

function isAllowedOrigin(origin) {
  if (!origin || allowedOrigins.includes(origin)) {
    return true;
  }

  if (process.env.NODE_ENV !== 'production') {
    try {
      const parsedOrigin = new URL(origin);
      return ['localhost', '127.0.0.1'].includes(parsedOrigin.hostname);
    } catch {
      return false;
    }
  }

  return false;
}

function corsOrigin(origin, callback) {
  if (isAllowedOrigin(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error('Not allowed by CORS'));
}

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
app.set('trust proxy', 1);
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

await configureSocketAdapter(io);

// Middleware
app.use(cors({
  origin: corsOrigin,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    product: 'Waveio',
    company: 'KRODOT',
    mode: dbMode,
    socketAdapter: socketAdapterStatus,
    timestamp: new Date().toISOString()
  });
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

app.use('/api/auth', authRouter);
app.use('/api/playlists', communityPlaylistsRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/youtube', youtubeRouter);

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
  console.log(`Waveio ${dbMode === 'postgres' ? 'Cloud' : 'LAN'} Server running on port ${PORT}`);
  console.log(`Socket adapter active: ${socketAdapterStatus.name}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log(`Network access: http://${localIP}:${PORT}`);
});

const shutdown = async (signal) => {
  console.log(`${signal} received, shutting down Waveio server`);
  await Promise.all(redisClients.map((client) => client.quit().catch((error) => {
    console.error('Redis shutdown error:', error);
  })));
  process.exit(0);
};

process.once('SIGINT', () => {
  shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  shutdown('SIGTERM');
});
