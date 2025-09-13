# Gymote Final Demo

This is a clean implementation of Gymote that uses the gymote npm package and provides a simple API for integration with any frontend framework.

## Structure

- `src/` - Main demo implementation (original demo moved here)
- `src/gymote-api.js` - Clean API wrapper for easy integration
- `examples/` - Simple examples showing how to use the API
- `server.js` - WebSocket server for communication

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Start the server:
```bash
npm run server
```

4. Open the demo:
   - Screen: http://localhost:3001
   - Remote: http://localhost:3001/remote

## Using the Clean API

The `gymote-api.js` provides a simple interface for integrating gymote into your projects:

### Remote Device (Phone/Controller)

```javascript
import { GymoteRemoteAPI } from './src/gymote-api.js';

const remote = new GymoteRemoteAPI();

// Connect to a room
await remote.connect('room123');

// Listen for events
remote.on('connected', () => console.log('Connected!'));
remote.on('coordinates', (coords) => {
    console.log(`X: ${coords.x}, Y: ${coords.y}, Clicking: ${coords.clicking}`);
});

// Control actions
remote.calibrate();
remote.setClicking(true);
```

### Screen Device (Computer/Display)

```javascript
import { GymoteScreenAPI } from './src/gymote-api.js';

const screen = new GymoteScreenAPI();

// Connect to a room
await screen.connect('room123');

// Listen for pointer events
screen.on('pointermove', (coords) => {
    // Move cursor to coords.x, coords.y
});

screen.on('pointerdown', () => {
    // Handle click start
});

screen.on('pointerup', () => {
    // Handle click end
});
```

## Simple Examples

Check the `examples/` folder for minimal implementations:

- `simple-remote.html` - Basic remote controller
- `simple-screen.html` - Basic screen display

These examples show how to use the API without the complexity of the full demo.

## API Reference

### GymoteRemoteAPI

- `connect(roomId)` - Connect to a room
- `hasGyroscope()` - Check if device has gyroscope
- `requestPermission()` - Request gyroscope permission
- `calibrate()` - Calibrate the gyroscope
- `setClicking(boolean)` - Set click state
- `getCoordinates()` - Get current coordinates
- `on(event, callback)` - Listen for events
- `disconnect()` - Disconnect from room

Events: `connected`, `disconnected`, `coordinates`

### GymoteScreenAPI

- `connect(roomId)` - Connect to a room
- `getCoordinates()` - Get current pointer coordinates
- `on(event, callback)` - Listen for events
- `disconnect()` - Disconnect from room

Events: `remote-connected`, `remote-disconnected`, `pointermove`, `pointerdown`, `pointerup`

### Utilities

- `generateRoomId()` - Generate a random room ID
- `isMobileDevice()` - Check if device is mobile

## Integration with Other Frameworks

The API is framework-agnostic and can be easily integrated with:

- React
- Vue.js
- Angular
- Vanilla JavaScript
- Any other frontend framework

Simply import the API classes and use them in your components.

## Server Requirements

The demo includes a Node.js server with Socket.IO for real-time communication. For production use, you can:

1. Use the included server as-is
2. Integrate the Socket.IO logic into your existing server
3. Replace Socket.IO with your preferred real-time communication method

The API is designed to be flexible and work with different backend implementations.