const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Opzioni di connessione MongoDB
    const options = {
      // Nuove opzioni di connessione
      useNewUrlParser: true,
      useUnifiedTopology: true,
      
      // Performance e connection pooling
      maxPoolSize: 10,           // Mantiene fino a 10 socket connections
      serverSelectionTimeoutMS: 5000, // Timeout dopo 5s invece di 30s
      socketTimeoutMS: 45000,    // Chiude sockets dopo 45s di inattività
      bufferCommands: false,     // Disabilita mongoose buffering
      
      // Heartbeat e monitoring
      heartbeatFrequencyMS: 2000,
      
      // Retry configuration
      retryWrites: true,
      retryReads: true,
    };

    // URI del database
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://waltercavaliere:Bid2426@bidwalter.6h6n7.mongodb.net/eventhub?retryWrites=true&w=majority';

    // Connessione
    const conn = await mongoose.connect(mongoURI, options);

    console.log(`🗄️  MongoDB connesso: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);

    // Event listeners per monitoraggio
    mongoose.connection.on('connected', () => {
      console.log('✅ Mongoose connesso a MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Errore connessione MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  Mongoose disconnesso da MongoDB');
    });

    // Gestione riconnessione automatica
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 Mongoose riconnesso a MongoDB');
    });

    return conn;

  } catch (error) {
    console.error('❌ Errore connessione database:', error.message);
    throw error;
  }
};

// Gestione chiusura connessione
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('✅ Connessione MongoDB chiusa correttamente');
  } catch (error) {
    console.error('❌ Errore chiusura connessione MongoDB:', error);
    throw error;
  }
};

module.exports = connectDB;
module.exports.disconnectDB = disconnectDB;