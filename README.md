# VideoChat - Secure Video Chat Application

A modern, secure video chat application similar to Omegle, built with Next.js, WebRTC, and real-time authentication.

## 🚀 Features

- 🔐 **Secure Authentication** - JWT-based login/registration with refresh tokens
- 📹 **WebRTC Video Chat** - Peer-to-peer video and audio communication
- 💬 **Real-time Messaging** - Instant chat during video calls
- 🎛️ **Media Controls** - Toggle camera and microphone on/off
- 👥 **Random Matching** - Connect with strangers instantly
- 🛡️ **Protected Routes** - Authenticated access to all features
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 🔄 **Automatic Reconnection** - Handles network interruptions gracefully

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Beautiful UI components
- **Socket.io Client** - Real-time communication
- **WebRTC** - Peer-to-peer video/audio

### Backend
- **Node.js** - Server runtime
- **Express** - Web framework
- **Socket.io** - WebSocket server
- **PostgreSQL** - Database
- **JWT** - Authentication tokens
- **bcrypt** - Password hashing

## 🏁 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- npm or yarn

### 1. Clone & Install

```bash
git clone <your-repo>
cd Yelloo

# Install frontend dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..
```

### 2. Database Setup

```bash
# Start PostgreSQL and create database
createdb videochat_db

# Set up schema
cd server
npm run db:setup
```

### 3. Environment Configuration

```bash
# Frontend environment
cp env.example .env.local

# Server environment
cd server
cp env.example .env
```

Update `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SERVER_URL=http://localhost:3001
```

Update `server/.env`:
```env
DB_HOST=localhost
DB_NAME=videochat_db
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=your_super_secret_jwt_key_here
JWT_REFRESH_SECRET=your_different_refresh_secret_here
```

### 4. Start Development

```bash
# Terminal 1: Start server
cd server
npm run dev

# Terminal 2: Start frontend
npm run dev
```

Visit `http://localhost:3000` to use the application.

## 📁 Project Structure

```
Yelloo/
├── app/                    # Next.js App Router
│   ├── chat/              # Video chat page
│   ├── settings/          # User settings
│   ├── layout.tsx         # Root layout with AuthProvider
│   └── page.tsx          # Login/register page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── VideoContainer.tsx # Video display component
│   ├── ChatContainer.tsx  # Chat interface
│   ├── ControlsPanel.tsx  # Media controls
│   ├── ConnectionStatus.tsx # Connection state
│   └── ProtectedRoute.tsx # Auth protection
├── contexts/             # React contexts
│   └── AuthContext.tsx   # Authentication state
├── hooks/                # Custom React hooks
│   ├── useMedia.ts       # Camera/microphone management
│   ├── useWebRTC.ts      # WebRTC connection logic
│   └── useWebSocket.ts   # Socket.io integration
├── lib/                  # Utilities
│   ├── auth.ts          # Authentication utilities
│   └── utils.ts         # General utilities
└── server/               # Backend server
    ├── config/          # Database configuration
    ├── middleware/      # Authentication & validation
    ├── routes/          # API endpoints
    ├── utils/           # Server utilities
    └── database/        # Database schema
```

## 🔐 Authentication Flow

### 1. Registration/Login
```typescript
// User registers or logs in
const { accessToken, refreshToken } = await authAPI.login(email, password)

// Tokens stored securely
tokenManager.setTokens({ accessToken, refreshToken })
```

### 2. Authenticated Requests
```typescript
// Automatic token refresh on API calls
const response = await apiRequest('/auth/me')

// WebSocket connection with authentication
const socket = io(url, {
  auth: { token: accessToken }
})
```

### 3. Token Management
- **Access Token**: 15 minutes (for API requests)
- **Refresh Token**: 7 days (for getting new access tokens)
- **Automatic Refresh**: Handled transparently
- **Secure Storage**: localStorage with automatic cleanup

## 🎥 WebRTC Integration

### Video Chat Flow
1. **Authentication** - User must be logged in
2. **Media Access** - Request camera/microphone permissions
3. **Matching** - Find another user looking for chat
4. **WebRTC Setup** - Establish peer-to-peer connection
5. **Signaling** - Exchange connection info via WebSocket
6. **Connected** - Video/audio streaming + chat

### Media Controls
```typescript
// Toggle camera
const handleCameraToggle = () => {
  setIsCameraOn(!isCameraOn)
  toggleVideo(!isCameraOn)        // Local stream
  toggleCamera(!isCameraOn)       // Notify partner
}
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout single session
- `POST /api/auth/logout-all` - Logout all sessions
- `GET /api/auth/me` - Get user profile
- `PUT /api/auth/me` - Update profile

### Health
- `GET /api/health` - Server status

## 📡 WebSocket Events

### Client → Server
- `find-match` - Join matching queue
- `skip-user` - Skip current partner
- `chat-message` - Send text message
- `toggle-camera` - Camera state change
- `toggle-mic` - Microphone state change
- `webrtc-*` - WebRTC signaling

### Server → Client
- `matched` - Found a partner
- `waiting-for-match` - Waiting in queue
- `partner-*` - Partner actions/state changes
- `webrtc-*` - WebRTC signaling

## 🛡️ Security Features

### Authentication
- JWT tokens with secure rotation
- Password hashing with bcrypt
- Protected routes and API endpoints
- Session management and tracking

### Rate Limiting
- Authentication attempts: 5/15min
- General API: 100/15min
- WebSocket connections: 20/5min

### Input Validation
- Email format validation
- Strong password requirements
- Username sanitization
- Message length limits

## 🚀 Production Deployment

### Frontend (Vercel)
```bash
# Build and deploy
npm run build
vercel deploy
```

### Backend (Railway/Heroku)
```bash
# Set environment variables
DB_HOST=your_production_db_host
JWT_SECRET=production_secret_key
NODE_ENV=production

# Deploy with Docker or platform CLI
```

### Environment Variables

**Frontend:**
```env
NEXT_PUBLIC_API_URL=https://your-api.com/api
NEXT_PUBLIC_SERVER_URL=https://your-api.com
```

**Backend:**
```env
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=production_secret
CORS_ORIGIN=https://your-frontend.com
```

## 🐛 Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check server is running on correct port
   - Verify CORS configuration
   - Ensure valid JWT token

2. **Video Not Working**
   - Grant camera/microphone permissions
   - Check browser compatibility
   - Test with different browsers

3. **Authentication Errors**
   - Verify JWT secrets match
   - Check token expiration
   - Clear localStorage and re-login

### Debug Tips
```bash
# Check server logs
cd server && npm run dev

# Inspect browser console
# Check Network tab for failed requests
# Verify WebSocket connection in DevTools
```

## 🔮 Future Enhancements

- [ ] Screen sharing
- [ ] Group video calls
- [ ] User profiles with photos
- [ ] Chat history
- [ ] File sharing
- [ ] Virtual backgrounds
- [ ] Mobile app (React Native)
- [ ] Voice-only mode
- [ ] Language preferences
- [ ] Moderation tools

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For support, email support@videochat.com or join our community Discord.

---

Built with ❤️ by the VideoChat team