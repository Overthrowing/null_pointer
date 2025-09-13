import { io } from 'socket.io-client';
import { GymoteScreen } from 'gymote';

class ScreenDemo {
  constructor() {
    // Connect to the current host (works for both localhost and network IP)
    this.socket = io();
    this.gymote = new GymoteScreen();
    this.roomId = this.generateRoomId();
    this.statusEl = document.getElementById('status');
    this.coordinatesEl = document.getElementById('coordinates');
    this.iframe = document.querySelector('.demo-area iframe');
    
    // Multiplayer state
    this.players = new Map(); // playerId -> { gymote, cursor, currentX, currentY, score }
    this.connectedPlayers = 0;
    this.scoreElements = {
      1: document.getElementById('score1'),
      2: document.getElementById('score2')
    };
    
    this.init();
  }
  
  generateRoomId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('room') || 'demo' + Math.floor(Math.random() * 1000);
  }
  
  init() {
    // Display room ID
    document.getElementById('roomId').textContent = this.roomId;
    
    // Display phone URL
    const phoneUrl = `${window.location.origin}/remote?room=${this.roomId}`;
    document.getElementById('phoneUrl').textContent = phoneUrl;
    
    // Join room as screen
    this.socket.emit('join-room', this.roomId, 'screen');
    
    // Send screen info to remote
    this.sendScreenInfo();
    
    // Socket events
    this.socket.on('devices-connected', (connectionInfo) => {
      this.connectedPlayers = connectionInfo.playersConnected;
      this.statusEl.textContent = `${this.connectedPlayers} player(s) connected!`;
      this.statusEl.className = 'status connected';
      this.updatePlayersList(connectionInfo.players);
    });
    
    this.socket.on('device-disconnected', () => {
      this.statusEl.textContent = 'All remotes disconnected';
      this.statusEl.className = 'status disconnected';
      this.clearAllPlayers();
    });
    
    this.socket.on('player-disconnected', (info) => {
      this.connectedPlayers = info.playersConnected;
      this.statusEl.textContent = `${this.connectedPlayers} player(s) connected`;
      this.removePlayer(info.playerId);
    });
    
    this.socket.on('gymote-data', (playerData) => {
      const { playerId, data } = playerData;
      
      // Convert the received data back to ArrayBuffer
      const buffer = new ArrayBuffer(data.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < data.length; i++) {
        view[i] = data[i];
      }
      
      // Create player if not exists
      if (!this.players.has(playerId)) {
        this.createPlayer(playerId);
      }
      
      const player = this.players.get(playerId);
      player.gymote.handleRemoteData(buffer);
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
      this.sendScreenInfo();
    });
  }
  
  sendScreenInfo() {
    const screenInfo = {
      width: window.innerWidth,
      height: window.innerHeight,
      distance: window.innerWidth // Use width as distance reference
    };
    
    this.socket.emit('screen-info', this.roomId, screenInfo);
  }
  
  createPlayer(playerId) {
    const player = {
      gymote: new GymoteScreen(),
      cursor: this.createCursor(playerId),
      currentX: 0,
      currentY: 0,
      score: 0
    };
    
    // Set up gymote events for this player
    player.gymote.on('pointermove', (coords) => {
      this.updatePlayerCursor(playerId, coords.x, coords.y);
      this.updateCoordinates(playerId, coords.x, coords.y);
    });
    
    player.gymote.on('pointerdown', () => {
      player.cursor.classList.add('clicking');
      this.forwardClickToIframe(player.currentX, player.currentY, 'mousedown', playerId);
    });
    
    player.gymote.on('pointerup', () => {
      player.cursor.classList.remove('clicking');
      this.forwardClickToIframe(player.currentX, player.currentY, 'mouseup', playerId);
      // Also send a click event for good measure
      setTimeout(() => {
        this.forwardClickToIframe(player.currentX, player.currentY, 'click', playerId);
      }, 10);
    });
    
    this.players.set(playerId, player);
    document.body.appendChild(player.cursor);
    this.updateScoreDisplay(playerId);
    
    console.log(`Created player ${playerId}`);
  }
  
  createCursor(playerId) {
    const cursor = document.createElement('div');
    cursor.className = `cursor player-${playerId}`;
    cursor.id = `cursor-${playerId}`;
    return cursor;
  }
  
  updatePlayerCursor(playerId, x, y) {
    const player = this.players.get(playerId);
    if (!player) return;
    
    // Clamp coordinates to screen bounds
    const clampedX = Math.max(0, Math.min(x, window.innerWidth));
    const clampedY = Math.max(0, Math.min(y, window.innerHeight));
    
    player.cursor.style.left = clampedX + 'px';
    player.cursor.style.top = clampedY + 'px';
    player.currentX = clampedX;
    player.currentY = clampedY;
  }
  
  updateCoordinates(playerId, x, y) {
    const playerText = playerId === 1 ? 'Red' : 'Blue';
    const existingText = this.coordinatesEl.textContent;
    const otherPlayerText = existingText.split(' | ').find(part => 
      !part.includes(playerText) && (part.includes('Red') || part.includes('Blue'))
    );
    
    const currentPlayerText = `${playerText}: X: ${Math.round(x)}, Y: ${Math.round(y)}`;
    
    if (otherPlayerText) {
      this.coordinatesEl.textContent = `${currentPlayerText} | ${otherPlayerText}`;
    } else {
      this.coordinatesEl.textContent = currentPlayerText;
    }
  }
  
  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      player.cursor.remove();
      this.players.delete(playerId);
      console.log(`Removed player ${playerId}`);
    }
  }
  
  clearAllPlayers() {
    for (const [playerId, player] of this.players) {
      player.cursor.remove();
    }
    this.players.clear();
    this.coordinatesEl.textContent = 'X: 0, Y: 0';
    
    // Reset scores
    this.scoreElements[1].textContent = '0';
    this.scoreElements[2].textContent = '0';
  }
  
  addScore(playerId, points) {
    const player = this.players.get(playerId);
    if (player) {
      player.score += points;
      this.updateScoreDisplay(playerId);
      console.log(`Player ${playerId} scored ${points} points! Total: ${player.score}`);
    }
  }
  
  updateScoreDisplay(playerId) {
    const player = this.players.get(playerId);
    if (player && this.scoreElements[playerId]) {
      this.scoreElements[playerId].textContent = player.score;
    }
  }
  
  updatePlayersList(playerIds) {
    // Remove players not in the list
    for (const playerId of this.players.keys()) {
      if (!playerIds.includes(playerId)) {
        this.removePlayer(playerId);
      }
    }
  }
  
  forwardClickToIframe(x, y, eventType, playerId) {
    if (!this.iframe) return;
    
    try {
      const iframeRect = this.iframe.getBoundingClientRect();
      
      // Calculate relative position within the iframe
      const relativeX = x - iframeRect.left;
      const relativeY = y - iframeRect.top;
      
      // Check if click is within iframe bounds
      if (relativeX >= 0 && relativeX <= iframeRect.width && 
          relativeY >= 0 && relativeY <= iframeRect.height) {
        
        // Try to access iframe content (same-origin)
        const iframeDoc = this.iframe.contentDocument || this.iframe.contentWindow.document;
        
        if (iframeDoc) {
          // Create mouse event with player info
          const mouseEvent = new MouseEvent(eventType, {
            bubbles: true,
            cancelable: true,
            clientX: relativeX,
            clientY: relativeY,
            button: 0, // Left mouse button
            buttons: eventType === 'mousedown' ? 1 : 0
          });
          
          // Add player info to the event
          mouseEvent.playerId = playerId;
          
          // Find the element at the click position
          const targetElement = iframeDoc.elementFromPoint(relativeX, relativeY);
          
          if (targetElement) {
            targetElement.dispatchEvent(mouseEvent);
            console.log(`Player ${playerId} forwarded ${eventType} to iframe at (${Math.round(relativeX)}, ${Math.round(relativeY)})`);
          } else {
            // Fallback: dispatch on iframe body
            iframeDoc.body.dispatchEvent(mouseEvent);
          }
        }
      }
    } catch (error) {
      // Cross-origin restrictions - try alternative approach
      this.forwardClickViaPostMessage(x, y, eventType, playerId);
    }
  }
  
  forwardClickViaPostMessage(x, y, eventType, playerId) {
    if (!this.iframe) return;
    
    try {
      const iframeRect = this.iframe.getBoundingClientRect();
      const relativeX = x - iframeRect.left;
      const relativeY = y - iframeRect.top;
      
      // Check if click is within iframe bounds
      if (relativeX >= 0 && relativeX <= iframeRect.width && 
          relativeY >= 0 && relativeY <= iframeRect.height) {
        
        // Send click data via postMessage with player info
        this.iframe.contentWindow.postMessage({
          type: 'simulateClick',
          eventType: eventType,
          x: relativeX,
          y: relativeY,
          button: 0,
          playerId: playerId
        }, '*');
        
        console.log(`Player ${playerId} sent ${eventType} via postMessage to iframe at (${Math.round(relativeX)}, ${Math.round(relativeY)})`);
      }
    } catch (error) {
      console.warn('Could not forward click to iframe:', error);
    }
  }
}

// Make screen demo available globally for scoring
let screenDemo = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  screenDemo = new ScreenDemo();
  window.screenDemo = screenDemo;
  
  // Listen for score events from the iframe game
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'gameScore') {
      const { playerId, points } = event.data;
      // Forward to screen demo if it exists
      if (screenDemo) {
        screenDemo.addScore(playerId, points);
      }
    }
  });
});