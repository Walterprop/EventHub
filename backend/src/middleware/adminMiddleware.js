const adminMiddleware = (req, res, next) => {
  try {
    // Verificare che l'utente sia autenticato
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticazione richiesta'
      });
    }

    // Verificare che l'utente sia admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accesso riservato agli amministratori'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Errore nella verifica dei permessi',
      error: error.message
    });
  }
};

module.exports = adminMiddleware;