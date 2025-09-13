const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const QRCode = require('qrcode');

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

// QR code endpoint
app.get('/qr/:roomId', async (req, res) => {
  try {
    const roomId = req.params.roomId;
    const remoteUrl = `${req.protocol}://${req.get('host')}/remote?room=${roomId}`;
    
    // Generate QR code as SVG
    const qrCode = await QRCode.toString(remoteUrl, {
      type: 'svg',
      width: 256,
      margin: 2,
      color: {
        dark: '#ffffff',
        light: '#1a1a1a'
      }
    });
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(qrCode);
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).send('Error generating QR code');
  }
});

// Socket.IO connection handling
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-room', (roomId, deviceType) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { screen: null, remotes: [] });
    }
    
    const room = rooms.get(roomId);
    
    if (deviceType === 'screen') {
      room.screen = socket.id;
    } else if (deviceType === 'remote') {
      // Assign player ID (max 2 players)
      if (room.remotes.length < 2) {
        const playerId = room.remotes.length === 0 ? 1 : 2;
        room.remotes.push({ socketId: socket.id, playerId });
        socket.playerId = playerId;
        
        // Send player assignment to the remote
        socket.emit('player-assigned', playerId);
      } else {
        socket.emit('room-full');
        return;
      }
    }
    
    console.log(`${deviceType} joined room ${roomId}${deviceType === 'remote' ? ` as player ${socket.playerId}` : ''}`);
    
    // Notify all devices about connection status
    if (room.screen && room.remotes.length > 0) {
      io.to(roomId).emit('devices-connected', {
        playersConnected: room.remotes.length,
        players: room.remotes.map(r => r.playerId)
      });
      console.log(`Room ${roomId} has ${room.remotes.length} player(s) connected`);
    }
  });

  socket.on('gymote-data', (roomId, data) => {
    // Forward gymote data to the screen with player ID
    socket.to(roomId).emit('gymote-data', {
      playerId: socket.playerId,
      data: data
    });
  });

  socket.on('screen-info', (roomId, screenInfo) => {
    // Forward screen info to the remote
    socket.to(roomId).emit('screen-info', screenInfo);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Clean up rooms
    for (const [roomId, room] of rooms.entries()) {
      if (room.screen === socket.id) {
        // Screen disconnected - notify all remotes
        socket.to(roomId).emit('device-disconnected');
        rooms.delete(roomId);
        break;
      } else {
        // Check if it's a remote
        const remoteIndex = room.remotes.findIndex(r => r.socketId === socket.id);
        if (remoteIndex !== -1) {
          const disconnectedPlayerId = room.remotes[remoteIndex].playerId;
          room.remotes.splice(remoteIndex, 1);
          
          // Notify remaining clients about disconnection
          socket.to(roomId).emit('player-disconnected', {
            playerId: disconnectedPlayerId,
            playersConnected: room.remotes.length,
            players: room.remotes.map(r => r.playerId)
          });
          
          console.log(`Player ${disconnectedPlayerId} disconnected from room ${roomId}`);
          
          // Delete room if no remotes left
          if (room.remotes.length === 0 && !room.screen) {
            rooms.delete(roomId);
          }
          break;
        }
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