const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware to set headers for Godot/WASM support
app.use((req, res, next) => {
  // Set specific headers for WASM files
  if (req.url.endsWith('.wasm')) {
    res.header('Content-Type', 'application/wasm');
  }
  
  // Set headers for Godot files - more permissive for audio
  if (req.url.includes('/public/duckhunt/')) {
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
  }
  
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/examples', express.static(path.join(__dirname, 'examples')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'screen.html'));
});

app.get('/remote', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'remote.html'));
});

// Socket.IO connection handling
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-room', (roomId, deviceType) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { screen: null, remote: null });
    }
    
    const room = rooms.get(roomId);
    room[deviceType] = socket.id;
    
    console.log(`${deviceType} joined room ${roomId}`);
    
    // Notify both devices when they're connected
    if (room.screen && room.remote) {
      io.to(roomId).emit('devices-connected');
      console.log(`Room ${roomId} is fully connected`);
    }
  });

  socket.on('gymote-data', (roomId, data) => {
    // Forward gymote data to the screen
    socket.to(roomId).emit('gymote-data', data);
  });

  socket.on('screen-info', (roomId, screenInfo) => {
    // Forward screen info to the remote
    socket.to(roomId).emit('screen-info', screenInfo);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Clean up rooms
    for (const [roomId, room] of rooms.entries()) {
      if (room.screen === socket.id || room.remote === socket.id) {
        rooms.delete(roomId);
        socket.to(roomId).emit('device-disconnected');
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0'; // Listen on all network interfaces

// Get local IP address
const os = require('os');
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();

server.listen(PORT, HOST, () => {
  console.log(`Gymote demo server running on:`);
  console.log(`  Local:    http://localhost:${PORT}`);
  console.log(`  Network:  http://${localIP}:${PORT}`);
  console.log('');
  console.log(`Screen (computer): http://${localIP}:${PORT}`);
  console.log(`Remote (phone):    http://${localIP}:${PORT}/remote`);
  console.log('');
  console.log('Make sure your phone and computer are on the same WiFi network!');
});