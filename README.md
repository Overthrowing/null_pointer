## Quick Start

### Prerequisites

- **Node.js** (version 14 or higher)
- **npm** (comes with Node.js)
- **Two devices on the same WiFi network**:
  - Computer/laptop for the game screen
  - Smartphone for the controller

### Installation

1. **Clone or download the project**
```bash
git clone <repo-url>
cd gymote-duckhunt-demo
```

2. **Install dependencies**
```bash
npm install
```

3. **Build the project**
```bash
npm run build
```

4. **Start the server**
```bash
npm start
```
*or*
```bash
node server.js
```

### How to Play

1. **Start the server** - You'll see output like:
   ```
   Gymote demo server running on:
     Local:    http://localhost:3001
     Network:  http://192.168.1.100:3001
   
   Screen (computer): http://192.168.1.100:3001
   Remote (phone):    http://192.168.1.100:3001/remote
   ```

2. **Open the game screen** on your computer:
   - Go to the Network URL (e.g., `http://192.168.1.100:3001`)
   - You'll see the Duck Hunt game in a retro CRT monitor frame

3. **Connect your phone**:
   - Open the remote URL on your phone (e.g., `http://192.168.1.100:3001/remote`)
   - Enter the Room ID shown on the screen (or use the auto-generated one)
   - Tap "CONNECT"
   - Grant gyroscope permission when prompted
   - Note: You may have to use an Ngrok tunnel to use the https version of the remote site if your phone blocks gyroscope access on http

4. **Start playing**:
   - Move your phone to aim the crosshair on screen
   - Tap "CALIBRATE" to center the cursor if needed
   - Tap the large "FIRE" button to shoot
   - The crosshair will turn green when firing
