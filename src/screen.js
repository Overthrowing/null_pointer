import { io } from 'socket.io-client';
import { GymoteScreen } from 'gymote';

class ScreenDemo {
  constructor() {
    // Connect to the current host (works for both localhost and network IP)
    this.socket = io();
    this.gymote = new GymoteScreen();
    this.roomId = this.generateRoomId();
    this.cursor = document.getElementById('cursor');
    this.statusEl = document.getElementById('status');
    this.coordinatesEl = document.getElementById('coordinates');
    this.iframe = document.querySelector('.demo-area iframe');
    
    // Track current cursor position for click forwarding
    this.currentX = 0;
    this.currentY = 0;
    
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
    this.socket.on('devices-connected', () => {
      this.statusEl.textContent = 'Remote connected!';
      this.statusEl.className = 'status connected';
    });
    
    this.socket.on('device-disconnected', () => {
      this.statusEl.textContent = 'Remote disconnected';
      this.statusEl.className = 'status disconnected';
    });
    
    this.socket.on('gymote-data', (data) => {
      // Convert the received data back to ArrayBuffer
      const buffer = new ArrayBuffer(data.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < data.length; i++) {
        view[i] = data[i];
      }
      this.gymote.handleRemoteData(buffer);
    });
    
    // Gymote events
    this.gymote.on('pointermove', (coords) => {
      this.updateCursor(coords.x, coords.y);
      this.updateCoordinates(coords.x, coords.y);
      // Store current position for click forwarding
      this.currentX = coords.x;
      this.currentY = coords.y;
    });
    
    this.gymote.on('pointerdown', () => {
      this.cursor.classList.add('clicking');
      this.forwardClickToIframe(this.currentX, this.currentY, 'mousedown');
    });
    
    this.gymote.on('pointerup', () => {
      this.cursor.classList.remove('clicking');
      this.forwardClickToIframe(this.currentX, this.currentY, 'mouseup');
      // Also send a click event for good measure
      setTimeout(() => {
        this.forwardClickToIframe(this.currentX, this.currentY, 'click');
      }, 10);
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
  
  updateCursor(x, y) {
    // Clamp coordinates to screen bounds
    const clampedX = Math.max(0, Math.min(x, window.innerWidth));
    const clampedY = Math.max(0, Math.min(y, window.innerHeight));
    
    this.cursor.style.left = clampedX + 'px';
    this.cursor.style.top = clampedY + 'px';
  }
  
  updateCoordinates(x, y) {
    this.coordinatesEl.textContent = `X: ${Math.round(x)}, Y: ${Math.round(y)}`;
  }
  
  forwardClickToIframe(x, y, eventType) {
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
          // Create mouse event
          const mouseEvent = new MouseEvent(eventType, {
            bubbles: true,
            cancelable: true,
            clientX: relativeX,
            clientY: relativeY,
            button: 0, // Left mouse button
            buttons: eventType === 'mousedown' ? 1 : 0
          });
          
          // Find the element at the click position
          const targetElement = iframeDoc.elementFromPoint(relativeX, relativeY);
          
          if (targetElement) {
            targetElement.dispatchEvent(mouseEvent);
            console.log(`Forwarded ${eventType} to iframe at (${Math.round(relativeX)}, ${Math.round(relativeY)})`);
          } else {
            // Fallback: dispatch on iframe body
            iframeDoc.body.dispatchEvent(mouseEvent);
          }
        }
      }
    } catch (error) {
      // Cross-origin restrictions - try alternative approach
      this.forwardClickViaPostMessage(x, y, eventType);
    }
  }
  
  forwardClickViaPostMessage(x, y, eventType) {
    if (!this.iframe) return;
    
    try {
      const iframeRect = this.iframe.getBoundingClientRect();
      const relativeX = x - iframeRect.left;
      const relativeY = y - iframeRect.top;
      
      // Check if click is within iframe bounds
      if (relativeX >= 0 && relativeX <= iframeRect.width && 
          relativeY >= 0 && relativeY <= iframeRect.height) {
        
        // Send click data via postMessage
        this.iframe.contentWindow.postMessage({
          type: 'simulateClick',
          eventType: eventType,
          x: relativeX,
          y: relativeY,
          button: 0
        }, '*');
        
        console.log(`Sent ${eventType} via postMessage to iframe at (${Math.round(relativeX)}, ${Math.round(relativeY)})`);
      }
    } catch (error) {
      console.warn('Could not forward click to iframe:', error);
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ScreenDemo();
});