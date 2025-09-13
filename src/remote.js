import { io } from 'socket.io-client';
import { GymoteRemote } from 'gymote';

class RemoteDemo {
  constructor() {
    // Connect to the current host (works for both localhost and network IP)
    this.socket = io();
    this.gymote = new GymoteRemote();
    this.roomId = null;
    this.isConnected = false;
    
    // UI elements
    this.roomInput = document.getElementById('roomInput');
    this.connectBtn = document.getElementById('connectBtn');
    this.statusEl = document.getElementById('status');
    this.controlsEl = document.getElementById('controls');
    this.clickBtn = document.getElementById('clickBtn');
    this.calibrateBtn = document.getElementById('calibrateBtn');
    this.coordinatesEl = document.getElementById('coordinates');
    this.setupEl = document.getElementById('setup');
    this.permissionBtn = document.getElementById('permissionBtn');
    
    this.init();
  }
  
  init() {
    // Add some debugging
    console.log('Initializing remote demo...');
    console.log('User agent:', navigator.userAgent);
    console.log('DeviceMotionEvent available:', !!window.DeviceMotionEvent);
    console.log('DeviceOrientationEvent available:', !!window.DeviceOrientationEvent);
    console.log('Needs permission:', this.gymote.gyroscope.needsPermission());
    
    // Set up gymote data handler
    this.gymote._onDataChange = (buffer) => {
      if (this.isConnected) {
        // Convert ArrayBuffer to regular array for socket transmission
        const array = Array.from(new Uint8Array(buffer));
        this.socket.emit('gymote-data', this.roomId, array);
        this.updateCoordinatesDisplay();
      }
    };
    
    // UI event listeners
    this.connectBtn.addEventListener('click', () => this.connect());
    this.permissionBtn.addEventListener('click', () => this.requestPermissionManually());
    this.clickBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.gymote.updateClick(true);
    });
    this.clickBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.gymote.updateClick(false);
    });
    this.clickBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.gymote.updateClick(true);
    });
    this.clickBtn.addEventListener('mouseup', (e) => {
      e.preventDefault();
      this.gymote.updateClick(false);
    });
    this.calibrateBtn.addEventListener('click', () => {
      this.gymote.calibrate();
    });
    
    // Socket events
    this.socket.on('devices-connected', () => {
      this.statusEl.textContent = 'Connected to screen!';
      this.statusEl.className = 'status connected';
      this.startGymote();
    });
    
    this.socket.on('device-disconnected', () => {
      this.statusEl.textContent = 'Screen disconnected';
      this.statusEl.className = 'status disconnected';
      this.gymote.stop();
    });
    
    this.socket.on('screen-info', (screenInfo) => {
      this.gymote.updateScreenViewport({
        width: screenInfo.width,
        height: screenInfo.height
      });
      this.gymote.updateScreenDistance(screenInfo.distance);
    });
    
    // Check URL for room parameter
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
      this.roomInput.value = roomFromUrl;
    }
    
    // Show permission button if needed
    if (this.gymote.gyroscope.needsPermission()) {
      this.permissionBtn.style.display = 'block';
    }
  }
  
  async requestPermissionManually() {
    try {
      this.permissionBtn.disabled = true;
      this.permissionBtn.textContent = 'Requesting permission...';
      
      const hasPermission = await this.gymote.requestGyroscopePermission();
      if (hasPermission) {
        this.permissionBtn.style.display = 'none';
        this.statusEl.textContent = 'Permission granted! You can now connect.';
        this.statusEl.className = 'status connected';
      } else {
        throw new Error('Permission denied');
      }
    } catch (error) {
      this.permissionBtn.disabled = false;
      this.permissionBtn.textContent = 'Request Gyroscope Permission';
      this.statusEl.textContent = `Permission error: ${error.message}`;
      this.statusEl.className = 'status disconnected';
    }
  }
  
  async connect() {
    this.roomId = this.roomInput.value.trim();
    if (!this.roomId) {
      alert('Please enter a room ID');
      return;
    }
    
    this.connectBtn.disabled = true;
    this.statusEl.textContent = 'Initializing gyroscope...';
    this.statusEl.className = 'status connecting';
    
    try {
      // Initialize gyronorm first (this is required before checking capabilities)
      this.gymote.gyroscope.initGyroNorm();
      
      // Wait a bit for initialization
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if device has gyroscope
      this.statusEl.textContent = 'Checking device capabilities...';
      const hasGyroscope = await this.gymote.deviceHasGyroscope();
      if (!hasGyroscope) {
        throw new Error('Device does not have a gyroscope or orientation sensors');
      }
      
      // Request permission if needed
      if (this.gymote.gyroscope.needsPermission()) {
        this.statusEl.textContent = 'Requesting gyroscope permission...';
        const hasPermission = await this.gymote.requestGyroscopePermission();
        if (!hasPermission) {
          throw new Error('Gyroscope permission denied');
        }
      }
      
      // Join room
      this.statusEl.textContent = 'Connecting to room...';
      this.socket.emit('join-room', this.roomId, 'remote');
      this.isConnected = true;
      
      // Hide setup, show controls
      this.setupEl.style.display = 'none';
      this.controlsEl.classList.add('active');
      
    } catch (error) {
      this.statusEl.textContent = `Error: ${error.message}`;
      this.statusEl.className = 'status disconnected';
      this.connectBtn.disabled = false;
      console.error('Connection error:', error);
    }
  }
  
  startGymote() {
    this.gymote.start();
    // Auto-calibrate after a short delay
    setTimeout(() => {
      this.gymote.calibrate();
    }, 1000);
  }
  
  updateCoordinatesDisplay() {
    // Get current coordinates from the gymote buffer
    const buffer = this.gymote.buffer;
    const intArray = new Int16Array(buffer);
    
    this.coordinatesEl.innerHTML = `
      X: ${intArray[0] || 0}, Y: ${intArray[1] || 0}<br>
      Clicking: ${intArray[2] ? 'Yes' : 'No'}
    `;
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new RemoteDemo();
});