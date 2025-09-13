/**
 * Gymote API - Clean interface for integrating gymote functionality
 * This provides a simple API that can be used with any frontend framework
 */

import { io } from 'socket.io-client';
import { GymoteRemote, GymoteScreen } from 'gymote';

/**
 * GymoteAPI - Main API class for gymote integration
 */
export class GymoteAPI {
  constructor(serverUrl = null) {
    this.serverUrl = serverUrl || window.location.origin;
    this.socket = null;
    this.roomId = null;
    this.isConnected = false;
    this.callbacks = {};
  }

  /**
   * Connect to a room
   * @param {string} roomId - Room identifier
   * @returns {Promise<boolean>} - Success status
   */
  async connect(roomId) {
    this.roomId = roomId;
    this.socket = io(this.serverUrl);
    
    return new Promise((resolve, reject) => {
      this.socket.on('connect', () => {
        this.socket.emit('join-room', roomId, this.deviceType);
        resolve(true);
      });
      
      this.socket.on('connect_error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Disconnect from the room
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
  }

  /**
   * Register event callbacks
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    this.callbacks[event] = callback;
  }

  /**
   * Emit an event to registered callbacks
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event](data);
    }
  }
}

/**
 * GymoteRemoteAPI - API for remote/controller devices
 */
export class GymoteRemoteAPI extends GymoteAPI {
  constructor(serverUrl = null) {
    super(serverUrl);
    this.deviceType = 'remote';
    this.gymote = new GymoteRemote();
    this.setupGymote();
  }

  setupGymote() {
    // Handle gymote data changes
    this.gymote._onDataChange = (buffer) => {
      if (this.isConnected && this.socket) {
        const array = Array.from(new Uint8Array(buffer));
        this.socket.emit('gymote-data', this.roomId, array);
        
        // Emit coordinates for external use
        const intArray = new Int16Array(buffer);
        this.emit('coordinates', {
          x: intArray[0] || 0,
          y: intArray[1] || 0,
          clicking: !!intArray[2]
        });
      }
    };
  }

  /**
   * Connect as remote device
   * @param {string} roomId - Room identifier
   * @returns {Promise<boolean>} - Success status
   */
  async connect(roomId) {
    await super.connect(roomId);
    
    return new Promise((resolve, reject) => {
      // Set up socket event listeners
      this.socket.on('devices-connected', () => {
        this.isConnected = true;
        this.emit('connected');
        this.gymote.start();
        resolve(true);
      });
      
      this.socket.on('device-disconnected', () => {
        this.isConnected = false;
        this.gymote.stop();
        this.emit('disconnected');
      });
      
      this.socket.on('screen-info', (screenInfo) => {
        this.gymote.updateScreenViewport({
          width: screenInfo.width,
          height: screenInfo.height
        });
        this.gymote.updateScreenDistance(screenInfo.distance);
      });
      
      // Timeout if no screen connects
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('No screen found in room'));
        }
      }, 10000);
    });
  }

  /**
   * Check if device has gyroscope
   * @returns {Promise<boolean>}
   */
  async hasGyroscope() {
    return await this.gymote.deviceHasGyroscope();
  }

  /**
   * Request gyroscope permission
   * @returns {Promise<boolean>}
   */
  async requestPermission() {
    return await this.gymote.requestGyroscopePermission();
  }

  /**
   * Calibrate the gyroscope
   */
  calibrate() {
    this.gymote.calibrate();
  }

  /**
   * Update click state
   * @param {boolean} isClicking - Whether currently clicking
   */
  setClicking(isClicking) {
    this.gymote.updateClick(isClicking);
  }

  /**
   * Get current coordinates
   * @returns {Object} - {x, y, clicking}
   */
  getCoordinates() {
    const buffer = this.gymote.buffer;
    const intArray = new Int16Array(buffer);
    return {
      x: intArray[0] || 0,
      y: intArray[1] || 0,
      clicking: !!intArray[2]
    };
  }
}

/**
 * GymoteScreenAPI - API for screen/display devices
 */
export class GymoteScreenAPI extends GymoteAPI {
  constructor(serverUrl = null) {
    super(serverUrl);
    this.deviceType = 'screen';
    this.gymote = new GymoteScreen();
    this.setupGymote();
  }

  setupGymote() {
    // Handle gymote events
    this.gymote.on('pointermove', (coords) => {
      this.emit('pointermove', coords);
    });
    
    this.gymote.on('pointerdown', () => {
      this.emit('pointerdown');
    });
    
    this.gymote.on('pointerup', () => {
      this.emit('pointerup');
    });
  }

  /**
   * Connect as screen device
   * @param {string} roomId - Room identifier
   * @returns {Promise<boolean>} - Success status
   */
  async connect(roomId) {
    await super.connect(roomId);
    
    return new Promise((resolve) => {
      // Set up socket event listeners
      this.socket.on('devices-connected', () => {
        this.isConnected = true;
        this.emit('remote-connected');
      });
      
      this.socket.on('device-disconnected', () => {
        this.isConnected = false;
        this.emit('remote-disconnected');
      });
      
      this.socket.on('gymote-data', (data) => {
        const buffer = new ArrayBuffer(data.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < data.length; i++) {
          view[i] = data[i];
        }
        this.gymote.handleRemoteData(buffer);
      });
      
      // Send screen info
      this.sendScreenInfo();
      
      // Handle window resize
      window.addEventListener('resize', () => {
        this.sendScreenInfo();
      });
      
      resolve(true);
    });
  }

  /**
   * Send screen information to remote
   */
  sendScreenInfo() {
    if (this.socket && this.roomId) {
      const screenInfo = {
        width: window.innerWidth,
        height: window.innerHeight,
        distance: window.innerWidth
      };
      this.socket.emit('screen-info', this.roomId, screenInfo);
    }
  }

  /**
   * Get current pointer coordinates
   * @returns {Object} - {x, y}
   */
  getCoordinates() {
    // This would need to be implemented in the gymote library
    // For now, return last known coordinates
    return this.lastCoordinates || { x: 0, y: 0 };
  }
}

/**
 * Utility function to generate room IDs
 * @returns {string} - Random room ID
 */
export function generateRoomId() {
  return 'room' + Math.floor(Math.random() * 10000);
}

/**
 * Utility function to check if device is mobile
 * @returns {boolean}
 */
export function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}