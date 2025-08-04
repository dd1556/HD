const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const compression = require('compression');

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "https://hd888.netlify.app",
      "http://localhost:3000",
      "http://localhost:22006"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

app.use(compression());
app.use(cors({
  origin: [
    "https://hd888.netlify.app",
    "http://localhost:3000",
    "http://localhost:22006"
  ],
  credentials: true
}));
app.use(express.json());

const clients = new Map();
let latestRadarData = null;

app.get('/', (req, res) => {
  res.json({
    status: 'CS2 Radar WebSocket Server Running',
    clients: clients.size,
    hasData: !!latestRadarData,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/radar-data', (req, res) => {
  try {
    const radarData = req.body;
    latestRadarData = {
      ...radarData,
      timestamp: Date.now()
    };
    
    io.emit('radar-update', latestRadarData);
    
    console.log(`Radar data received and broadcasted to ${clients.size} clients`);
    res.json({ success: true, clients: clients.size });
  } catch (error) {
    console.error('Error processing radar data:', error);
    res.status(500).json({ error: 'Failed to process radar data' });
  }
});

io.on('connection', (socket) => {
  const clientId = socket.id;
  const clientInfo = {
    id: clientId,
    connectedAt: Date.now(),
    ip: socket.handshake.address
  };
  
  clients.set(clientId, clientInfo);
  console.log(`Client connected: ${clientId} (Total: ${clients.size})`);
  
  if (latestRadarData) {
    socket.emit('radar-update', latestRadarData);
  }
  
  socket.emit('server-status', {
    connected: true,
    clientId: clientId,
    serverTime: Date.now()
  });
  
  socket.on('disconnect', () => {
    clients.delete(clientId);
    console.log(`Client disconnected: ${clientId} (Total: ${clients.size})`);
  });
  
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
});

setInterval(() => {
  if (latestRadarData && Date.now() - latestRadarData.timestamp > 30000) {
    latestRadarData = null;
    io.emit('radar-disconnected');
    console.log('Radar data expired, notifying clients');
  }
}, 5000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(` CS2 Radar WebSocket Server running on port ${PORT}`);
  console.log(` WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(` HTTP endpoint: http://localhost:${PORT}`);
  console.log(` API endpoint: http://localhost:${PORT}/api/radar-data`);
});

process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };