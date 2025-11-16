const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
console.log('🔧 Loading .env from:', path.join(__dirname, '../.env'));
console.log('🔑 JWT_SECRET loaded:', process.env.JWT_SECRET ? 'YES' : 'NO');
const { createServer } = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/database');
const SocketHandler = require('./sockets/socketHandler');

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Funzione per avviare il server
const startServer = async () => {
  try {
    // Connessione al database
    await connectDB();
    console.log('✅ Database connesso con successo');

    // Creare server HTTP
    const server = createServer(app);

    // Setup Socket.io
    const io = new Server(server, {
      cors: {
        origin: [
          'http://localhost:3000',
          'http://localhost:3001',
          process.env.FRONTEND_URL,
          process.env.ADMIN_URL
        ].filter(Boolean),
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // Inizializzare Socket Handler
    const socketHandler = new SocketHandler(io);

    // Rendere socketHandler disponibile globalmente per i controller
    app.set('socketHandler', socketHandler);

    // Avvio server
    server.listen(PORT, () => {
      console.log(`🚀 Server in esecuzione in modalità ${NODE_ENV} sulla porta ${PORT}`);
      console.log(`📱 API disponibili su: http://localhost:${PORT}/api`);
      console.log(`⚡ Socket.io attivo per connessioni real-time`);
      console.log(`💊 Health check: http://localhost:${PORT}/api/health`);
      
      if (NODE_ENV === 'development') {
        console.log(`📚 Documentazione API: http://localhost:${PORT}/api`);
      }
    });

    // Gestione errori server
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

      switch (error.code) {
        case 'EACCES':
          console.error(`❌ ${bind} richiede privilegi elevati`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          console.error(`❌ ${bind} è già in uso`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

    // Graceful shutdown
    const gracefulShutdown = () => {
      console.log('\n🔄 Avvio spegnimento graceful...');
      
      // Chiudere connessioni Socket.io
      io.close(() => {
        console.log('✅ Socket.io chiuso');
      });
      
      server.close((err) => {
        if (err) {
          console.error('❌ Errore durante chiusura server:', err);
          process.exit(1);
        }
        console.log('✅ Server chiuso correttamente');
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    // Log statistiche Socket.io ogni 30 secondi (solo in development)
    if (NODE_ENV === 'development') {
      setInterval(() => {
        const connectedCount = socketHandler.getConnectedUsersCount();
        if (connectedCount > 0) {
          console.log(`📊 Utenti connessi: ${connectedCount}`);
        }
      }, 30000);
    }

  } catch (error) {
    console.error('❌ Errore avvio server:', error.message);
    process.exit(1);
  }
};

// Avvia il server
startServer();