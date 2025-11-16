const rateLimit = require('express-rate-limit');

// Rate limit generale
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100, // 100 richieste per IP
  message: {
    success: false,
    message: 'Troppe richieste da questo IP, riprova tra 15 minuti'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limit per auth (più restrittivo)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 5, // 5 tentativi di login per IP
  message: {
    success: false,
    message: 'Troppi tentativi di login, riprova tra 15 minuti'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limit per creazione eventi
const createEventLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 10, // 10 eventi per ora per IP
  message: {
    success: false,
    message: 'Troppi eventi creati, riprova tra 1 ora'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limit per chat
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // 30 messaggi per minuto per IP
  message: {
    success: false,
    message: 'Troppi messaggi inviati, rallenta un po\''
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  generalLimiter,
  authLimiter,
  createEventLimiter,
  chatLimiter
};