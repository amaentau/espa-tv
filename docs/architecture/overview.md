# Architecture Overview

## System Components

### 1. Raspberry Pi Component
**Purpose**: Stream playback and local control
**Technology**: Node.js + Puppeteer + Chromium
**Responsibilities**:
- Launch Chromium in kiosk mode
- Load and display Veo streams
- Handle fullscreen mode
- Provide local HTTP/WebSocket APIs
- Connect to cloud service for remote control

### 2. Cloud Service
**Purpose**: Device management and command routing
**Technology**: Node.js + Express + Socket.IO + MongoDB
**Responsibilities**:
- Device registration and discovery
- Command routing between mobile apps and devices
- Real-time communication via WebSocket
- REST API for device management
- Optional: Device state persistence

### 3. Mobile Application
**Purpose**: Remote device control
**Technology**: React Native
**Responsibilities**:
- Device discovery and listing
- Real-time device control interface
- Stream playback controls
- Settings and configuration
- Cross-platform (iOS/Android)

## Communication Flow

```
Mobile App ↔ Cloud Service ↔ Raspberry Pi Device
     ↑             ↑               ↑
   HTTP/WS      HTTP/WS         HTTP/WS
```

### Real-time Communication
- **WebSocket**: Real-time commands and status updates
- **HTTP REST**: Device management and configuration
- **Event-driven**: Status changes propagate through the system

## Data Flow

### Device Registration
1. Raspberry Pi connects to Cloud Service
2. Registers with unique ID and capabilities
3. Cloud Service stores device information
4. Mobile app queries available devices

### Command Execution
1. Mobile app sends command to Cloud Service
2. Cloud Service routes command to target device
3. Raspberry Pi executes command via Puppeteer
4. Status updates flow back through the chain

## Security Architecture

### Network Security
- HTTPS/WSS for all external communications
- CORS configuration for allowed origins
- Input validation and sanitization

### Device Authentication
- Device registration with unique identifiers
- Optional: JWT tokens for authenticated commands
- IP whitelisting for device connections

### Data Protection
- No sensitive data stored on devices
- Encrypted communication channels
- Secure configuration management

## Scalability Considerations

### Horizontal Scaling
- Multiple Cloud Service instances behind load balancer
- Device-to-instance mapping for session affinity
- Database clustering for persistence

### Performance Optimization
- WebSocket connection pooling
- Command queuing for offline devices
- Efficient device discovery mechanisms

## Deployment Architecture

### Development Environment
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │  Cloud Service  │    │ Raspberry Pi    │
│   (localhost)   │◄──►│   (localhost)   │◄──►│   (localhost)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Production Environment
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile Apps   │    │ Cloud Service   │    │  Raspberry Pi   │
│  (App Store)    │◄──►│   (AWS/GCP)     │◄──►│ (Customer LAN)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │    MongoDB      │
                       │   (Atlas)       │
                       └─────────────────┘
```

## Component Interactions

### Raspberry Pi ↔ Cloud Service
- **Registration**: Device announces presence and capabilities
- **Heartbeat**: Periodic status updates
- **Commands**: Execute control commands (play, pause, fullscreen)
- **Status**: Report current playback state

### Cloud Service ↔ Mobile App
- **Device List**: Provide available devices
- **Command Proxy**: Forward commands to devices
- **Status Updates**: Real-time device status changes
- **Configuration**: App settings and preferences

### Mobile App ↔ User
- **Discovery**: Find and connect to devices
- **Control**: Send playback commands
- **Feedback**: Display device status and responses
- **Settings**: Configure app behavior

## Error Handling

### Network Failures
- Automatic reconnection with exponential backoff
- Offline command queuing
- Graceful degradation of functionality

### Device Failures
- Device health monitoring
- Automatic cleanup of disconnected devices
- Fallback to local control when cloud unavailable

### Command Failures
- Command timeout handling
- Retry logic with configurable limits
- User feedback for failed operations
