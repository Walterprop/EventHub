const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authMiddleware = async (req, res, next) => {
  try {
    // Ottenere token dall'header Authorization
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token di accesso richiesto'
      });
    }

    const token = authHeader.substring(7); // Rimuove "Bearer "

    // Verificare token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Trovare utente
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token non valido - utente non trovato'
      });
    }

    // Verificare se utente è bloccato
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Account bloccato. Contatta l\'amministratore.'
      });
    }

    // Aggiungere utente alla request
    req.user = user;
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token non valido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token scaduto'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Errore nell\'autenticazione',
      error: error.message
    });
  }
};

module.exports = authMiddleware;