const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

// Import routes e middleware
const routes = require('./routes');
const { errorMiddleware, rateLimiters } = require('./middleware');

// Import Swagger
const { swaggerUi, specs } = require('./config/swagger');

// Creare app Express
const app = express();

// Trust proxy (importante per deployment)
app.set('trust proxy', 1);

// Security middleware (configurazione per API-only)
app.use(helmet({
  contentSecurityPolicy: false, // Non necessario per API-only
  crossOriginEmbedderPolicy: false
}));

// CORS configuration - Permissivo per testare API con Swagger/Postman
const corsOptions = {
  origin: '*', // Permette richieste da qualsiasi origine (ok per API di test)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting generale
app.use(rateLimiters.general);

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Static files (per upload di immagini)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }'
}));

// Root endpoint per informazioni API
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'EventHub API Server',
    version: '1.0.0',
    documentation: '/api-docs',
    endpoints: {
      auth: '/api/auth',
      events: '/api/events',
      notifications: '/api/notifications',
      admin: '/api/admin',
      chat: '/api/chat'
    }
  });
});

// API Routes
app.use('/api', routes);

// 404 Handler per tutte le route non trovate
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.originalUrl} non trovato`,
    hint: 'Visita /api-docs per la documentazione completa'
  });
});

// Global error handler
app.use(errorMiddleware);

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

module.exports = app;