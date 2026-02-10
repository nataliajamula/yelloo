# VideoChat Server

A secure WebSocket server for real-time video chat with JWT authentication, PostgreSQL database, and comprehensive user management.

## Features

- 🔐 JWT-based authentication with refresh tokens
- 🗄️ PostgreSQL database with proper schema
- 🛡️ Security middleware (helmet, CORS, rate limiting)
- 📡 WebSocket authentication for real-time communication
- 🧹 Automatic cleanup of expired tokens and sessions
- 📊 Session tracking and user management
- ⚡ Graceful shutdown and error handling

## Prerequisites

- Node.js 16+ 
- PostgreSQL 12+
- npm or yarn

## Quick Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Database Setup

Create a PostgreSQL database:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE videochat_db;

# Exit psql
\q
```

Run the schema setup:

```bash
# Option 1: Using npm script
npm run db:setup

# Option 2: Manual setup
psql -U postgres -d videochat_db -f database/schema.sql
```

### 3. Environment Configuration

Copy the example environment file:

```bash
cp env.example .env
```

Update `.env` with your configuration:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=videochat_db
DB_USER=postgres
DB_PASSWORD=your_actual_password

# JWT Configuration (CHANGE THESE!)
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
JWT_REFRESH_SECRET=your_super_secret_refresh_key_here_make_it_different

# Server Configuration
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### 4. Start the Server

```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

## API Endpoints

### Authentication Routes (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | User registration | ❌ |
| POST | `/login` | User login | ❌ |
| POST | `/refresh` | Refresh access token | ❌ |
| POST | `/logout` | Logout (revoke refresh token) | ✅ |
| POST | `/logout-all` | Logout from all devices | ✅ |
| GET | `/me` | Get current user profile | ✅ |
| PUT | `/me` | Update user profile | ✅ |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health status |

## WebSocket Events

### Client → Server

| Event | Description | Auth Required |
|-------|-------------|---------------|
| `find-match` | Join matching queue | ✅ |
| `webrtc-offer` | Send WebRTC offer | ✅ |
| `webrtc-answer` | Send WebRTC answer | ✅ |
| `webrtc-ice-candidate` | Send ICE candidate | ✅ |
| `chat-message` | Send chat message | ✅ |
| `skip-user` | Skip current partner | ✅ |
| `toggle-camera` | Toggle camera state | ✅ |
| `toggle-mic` | Toggle microphone state | ✅ |

### Server → Client

| Event | Description |
|-------|-------------|
| `matched` | Successfully matched with user |
| `waiting-for-match` | Waiting in queue |
| `partner-skipped` | Partner skipped |
| `partner-disconnected` | Partner disconnected |
| `already-in-room` | User already in active room |
| `webrtc-offer` | Receive WebRTC offer |
| `webrtc-answer` | Receive WebRTC answer |
| `webrtc-ice-candidate` | Receive ICE candidate |
| `chat-message` | Receive chat message |
| `partner-camera-toggle` | Partner camera state change |
| `partner-mic-toggle` | Partner microphone state change |

## Security Features

### Rate Limiting

- **General API**: 100 requests per 15 minutes
- **Authentication**: 5 attempts per 15 minutes
- **Password Reset**: 3 attempts per hour
- **Reports**: 10 reports per hour
- **Socket Connections**: 20 connections per 5 minutes

### Password Security

- Minimum 8 characters
- Must contain uppercase, lowercase, number, and special character
- Hashed with bcrypt (12 rounds)

### JWT Tokens

- **Access Token**: 15 minutes expiry
- **Refresh Token**: 7 days expiry
- Stored in database for revocation
- Automatic cleanup of expired tokens

## Database Schema

### Core Tables

- `users` - User accounts and authentication
- `refresh_tokens` - JWT refresh token management
- `user_sessions` - Socket connection tracking
- `chat_rooms` - Video chat room records
- `room_participants` - Room membership tracking
- `chat_messages` - Message history (optional)
- `user_reports` - User reporting system
- `blocked_users` - User blocking functionality

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

### Database Migrations

For schema changes, create migration files:

```bash
# Create new migration
npm run migrate:create migration_name

# Run migrations
npm run migrate:up

# Rollback migrations
npm run migrate:down
```

### Monitoring

Check server status:

```bash
# Health check
curl http://localhost:3001/api/health

# Database connection
npm run db:check
```

## Production Deployment

### Environment Variables

Set these in production:

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=production_secret_key
JWT_REFRESH_SECRET=production_refresh_secret
CORS_ORIGIN=https://yourdomain.com
```

### Security Checklist

- ✅ Use strong JWT secrets (64+ characters)
- ✅ Enable SSL/TLS (HTTPS)
- ✅ Configure proper CORS origins
- ✅ Set up database SSL
- ✅ Monitor rate limits
- ✅ Regular security updates
- ✅ Database backups
- ✅ Log monitoring

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check PostgreSQL is running
   sudo systemctl status postgresql
   
   # Verify database exists
   psql -U postgres -l
   ```

2. **Authentication Errors**
   ```bash
   # Check JWT secrets are set
   echo $JWT_SECRET
   
   # Verify token format
   curl -H "Authorization: Bearer <token>" http://localhost:3001/api/auth/me
   ```

3. **WebSocket Connection Issues**
   ```bash
   # Check CORS configuration
   # Verify client sends auth token
   # Check browser console for errors
   ```

### Logs

Server logs include:

- 🔌 Database connections
- 👤 User authentication events
- 📡 WebSocket connections/disconnections
- 🧹 Cleanup operations
- ❌ Error details

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.