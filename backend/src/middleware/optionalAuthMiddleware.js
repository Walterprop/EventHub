const jwt = require('jsonwebtoken');
const { User } = require('../models');

const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    // Se non c'è token, continua senza autenticazione
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && !user.isBlocked) {
        req.user = user;
      } else {
        req.user = null;
      }
    } catch (error) {
      // Se il token è invalido, continua senza autenticazione
      req.user = null;
    }

    next();
    
  } catch (error) {
    // In caso di errore, continua senza autenticazione
    req.user = null;
    next();
  }
};

module.exports = optionalAuthMiddleware; 