const express = require('express');
const authRoutes = require('./authRoutes');
const eventRoutes = require('./eventRoutes');
const adminRoutes = require('./adminRoutes');
const chatRoutes = require('./chatRoutes');
const notificationRoutes = require('./notificationRoutes');
const socketRoutes = require('./socketRoutes');

const router = express.Router();

// API Routes
router.use('/auth', authRoutes);
router.use('/events', eventRoutes);
router.use('/admin', adminRoutes);
router.use('/chat', chatRoutes);
router.use('/notifications', notificationRoutes);
router.use('/socket', socketRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  const socketHandler = req.app.get('socketHandler');
  const onlineUsers = socketHandler ? socketHandler.getConnectedUsersCount() : 0;
  
  res.json({
    success: true,
    message: 'EventHub API is running',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || '1.0.0',
    realtime: {
      enabled: !!socketHandler,
      connectedUsers: onlineUsers
    }
  });
});

// API documentation endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'EventHub API',
    version: process.env.API_VERSION || '1.0.0',
    documentation: '/docs',
    endpoints: {
      auth: '/api/auth',
      events: '/api/events',
      admin: '/api/admin',
      chat: '/api/chat',
      notifications: '/api/notifications',
      socket: '/api/socket'
    },
    realtime: {
      enabled: true,
      features: ['chat', 'notifications', 'event_updates', 'user_presence']
    }
  });
});

module.exports = router;