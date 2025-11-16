const { User } = require('../models');
const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class AuthController {
  // POST /api/auth/register - Registrazione utente
  async register(req, res) {
    try {
      console.log('🔐 Tentativo registrazione:', req.body);
      
      // Validazione input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Errori validazione:', errors.array());
        return res.status(400).json({
          success: false,
          message: 'Dati non validi',
          errors: errors.array()
        });
      }

      const { email, password, name } = req.body;
      console.log('✅ Validazione passed, dati:', { email, name, passwordLength: password?.length });

      // Verificare se email già esistente
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        console.log('❌ Email già esistente:', email);
        return res.status(400).json({
          success: false,
          message: 'Email già registrata'
        });
      }

      console.log('✅ Email disponibile, creazione utente...');

      // Creare nuovo utente
      const user = new User({
        email,
        password, // Verrà hashata automaticamente dal pre-save hook
        name,
        verificationToken: crypto.randomBytes(32).toString('hex'),
        verificationExpires: Date.now() + 24 * 60 * 60 * 1000 // 24 ore
      });

      console.log('✅ User object creato, salvataggio...');
      await user.save();
      console.log('✅ Utente salvato con ID:', user._id);

      // Generare JWT tokens
      const accessToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
      );

      const refreshToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
      );

      console.log('✅ Tokens generati');

      res.status(201).json({
        success: true,
        message: 'Registrazione completata con successo',
        data: {
          user: user.toSafeObject(),
          token: accessToken,
          refreshToken: refreshToken
        }
      });
    } catch (error) {
      console.error('❌ Errore registrazione:', error);
      res.status(500).json({
        success: false,
        message: 'Errore durante la registrazione',
        error: error.message
      });
    }
  }

  // POST /api/auth/login - Login utente
  async login(req, res) {
    try {
      console.log('🔑 Tentativo login:', req.body);
      
      // Validazione input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Errori validazione login:', errors.array());
        return res.status(400).json({
          success: false,
          message: 'Dati non validi',
          errors: errors.array()
        });
      }

      const { email, password } = req.body;
      console.log('✅ Validazione login passed:', { email, passwordLength: password?.length });

      // Trovare utente per email
      const user = await User.findOne({ email }).select('+password');
      console.log('🔍 Ricerca utente per email:', email, 'trovato:', !!user);
      
      if (!user) {
        console.log('❌ Utente non trovato');
        return res.status(401).json({
          success: false,
          message: 'Credenziali non valide'
        });
      }

      // Verificare se utente è bloccato
      if (user.isBlocked) {
        console.log('❌ Utente bloccato:', email);
        return res.status(403).json({
          success: false,
          message: 'Account bloccato. Contatta l\'amministratore.'
        });
      }

      console.log('✅ Utente trovato, verifica password...');
      
      // Verificare password
      const isPasswordValid = await user.comparePassword(password);
      console.log('🔐 Password valid:', isPasswordValid);
      
      if (!isPasswordValid) {
        console.log('❌ Password non valida');
        return res.status(401).json({
          success: false,
          message: 'Credenziali non valide'
        });
      }

      console.log('✅ Password corretta, generazione tokens...');
      console.log('🔍 JWT_SECRET:', process.env.JWT_SECRET ? 'DEFINED' : 'UNDEFINED');
      
      // Generare JWT tokens
      const accessToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
      );

      const refreshToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
      );

      console.log('✅ Tokens generati, invio risposta...');

      res.json({
        success: true,
        message: 'Login effettuato con successo',
        data: {
          user: user.toSafeObject(),
          token: accessToken,
          refreshToken: refreshToken
        }
      });
    } catch (error) {
      console.error('❌ Errore login:', error);
      res.status(500).json({
        success: false,
        message: 'Errore durante il login',
        error: error.message
      });
    }
  }

  // POST /api/auth/refresh - Refresh token
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token mancante'
        });
      }

      // Verificare refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      const user = await User.findById(decoded.userId);

      if (!user || user.isBlocked) {
        return res.status(401).json({
          success: false,
          message: 'Token non valido'
        });
      }

      // Generare nuovi tokens
      const tokens = this.generateTokens(user._id);

      res.json({
        success: true,
        message: 'Token aggiornato con successo',
        data: {
          user: user.toSafeObject(),
          ...tokens
        }
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: 'Token non valido o scaduto',
        error: error.message
      });
    }
  }

  // POST /api/auth/logout - Logout utente
  async logout(req, res) {
    try {
      // In un'implementazione più avanzata, potresti aggiungere
      // il token a una blacklist o invalidarlo nel database
      res.json({
        success: true,
        message: 'Logout effettuato con successo'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore durante il logout',
        error: error.message
      });
    }
  }

  // POST /api/auth/forgot-password - Richiesta reset password
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        // Non rivelare se l'email esiste o meno per sicurezza
        return res.json({
          success: true,
          message: 'Se l\'email esiste, riceverai le istruzioni per il reset'
        });
      }

      // Generare token reset
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 ora

      await user.save();

      // TODO: Inviare email con il token
      // await emailService.sendPasswordReset(user.email, resetToken);

      res.json({
        success: true,
        message: 'Email di reset inviata con successo',
        // In development, restituire il token per testing
        ...(process.env.NODE_ENV === 'development' && { resetToken })
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nell\'invio dell\'email di reset',
        error: error.message
      });
    }
  }

  // POST /api/auth/reset-password - Reset password
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      // Trovare utente con token valido
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Token non valido o scaduto'
        });
      }

      // Aggiornare password
      user.password = newPassword; // Verrà hashata dal pre-save hook
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;

      await user.save();

      res.json({
        success: true,
        message: 'Password reimpostata con successo'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel reset della password',
        error: error.message
      });
    }
  }

  // GET /api/auth/me - Ottenere profilo utente corrente
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utente non trovato'
        });
      }

      res.json({
        success: true,
        data: user.toSafeObject()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel recuperare il profilo',
        error: error.message
      });
    }
  }

  // PUT /api/auth/profile - Aggiornare profilo utente
  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { name, avatar } = req.body;

      const user = await User.findByIdAndUpdate(
        userId,
        { name, avatar },
        { new: true, runValidators: true }
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utente non trovato'
        });
      }

      res.json({
        success: true,
        message: 'Profilo aggiornato con successo',
        data: user.toSafeObject()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nell\'aggiornamento del profilo',
        error: error.message
      });
    }
  }

  // PUT /api/auth/change-password - Cambiare password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      // Trovare utente con password
      const user = await User.findById(userId).select('+password');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utente non trovato'
        });
      }

      // Verificare password attuale
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Password attuale non corretta'
        });
      }

      // Aggiornare password
      user.password = newPassword;
      await user.save();

      res.json({
        success: true,
        message: 'Password cambiata con successo'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel cambio password',
        error: error.message
      });
    }
  }

  // Metodo helper per generare JWT tokens
  generateTokens(userId) {
    const accessToken = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    const refreshToken = jwt.sign(
      { userId },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    return { accessToken, refreshToken };
  }
}

module.exports = new AuthController();