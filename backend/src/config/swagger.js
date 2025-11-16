const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EventHub API',
      version: '1.0.0',
      description: `API REST per la gestione eventi EventHub con autenticazione JWT, notifiche real-time e sistema di approvazione admin

## 🔐 Account di Test

### 👤 Account Utente
- **Email:** mario.rossi@example.com
- **Password:** User123

### 👨‍💼 Account Admin  
- **Email:** pepocavaliere@gmail.com
- **Password:** Password123

### 📝 Come usare l'API
1. Fai login con uno degli account sopra usando **POST /api/auth/login**
2. Copia il **token** dalla risposta
3. Clicca sul pulsante **Authorize** 🔒 in alto
4. Incolla il token e clicca "Authorize"
5. Ora puoi testare tutti gli endpoint protetti!`,
      contact: {
        name: 'EventHub Team',
        email: 'walter.cavaliere@edu-its.it'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://eventhub-fh0o.onrender.com' 
          : 'http://localhost:5000',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Event: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            date: {
              type: 'object',
              properties: {
                start: { type: 'string', format: 'date-time' },
                end: { type: 'string', format: 'date-time' }
              }
            },
            location: {
              type: 'object',
              properties: {
                address: { type: 'string' },
                city: { type: 'string' },
                country: { type: 'string' }
              }
            },
            capacity: { type: 'number' },
            price: {
              type: 'object',
              properties: {
                amount: { type: 'number' },
                currency: { type: 'string' },
                isFree: { type: 'boolean' }
              }
            },
            status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
            createdBy: { type: 'string' }
          }
        },
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string', enum: ['user', 'admin'] },
            avatar: { type: 'string' }
          }
        },
        Notification: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            message: { type: 'string' },
            type: { type: 'string' },
            recipient: { type: 'string' },
            read: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  },
  apis: [
    '/app/backend/src/routes/*.js'
  ]
};

const specs = swaggerJsdoc(options);

module.exports = { swaggerUi, specs };