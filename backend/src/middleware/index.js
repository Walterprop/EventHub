const authMiddleware = require('./authMiddleware');
const optionalAuthMiddleware = require('./optionalAuthMiddleware');
const adminMiddleware = require('./adminMiddleware');
const errorMiddleware = require('./errorMiddleware');
const { 
  generalLimiter, 
  authLimiter, 
  createEventLimiter, 
  chatLimiter 
} = require('./rateLimitMiddleware');

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  adminMiddleware,
  errorMiddleware,
  rateLimiters: {
    general: generalLimiter,
    auth: authLimiter,
    createEvent: createEventLimiter,
    chat: chatLimiter
  }
};