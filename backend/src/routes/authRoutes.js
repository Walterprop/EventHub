const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/AuthController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: API per l'autenticazione
 */

// Validazioni per registrazione
const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Email non valida')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password deve essere di almeno 6 caratteri'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nome deve essere tra 2 e 50 caratteri')
];

// Validazioni per login
const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Email non valida')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password richiesta')
];

// Validazioni per reset password
const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Token richiesto'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Password deve essere di almeno 6 caratteri')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password deve contenere almeno: 1 minuscola, 1 maiuscola, 1 numero')
];

// Validazioni per cambio password
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Password attuale richiesta'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Nuova password deve essere di almeno 6 caratteri')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password deve contenere almeno: 1 minuscola, 1 maiuscola, 1 numero')
];

// Routes pubbliche

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registra un nuovo utente
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: "Mario Rossi" }
 *               email: { type: string, example: "mario@example.com" }
 *               password: { type: string, example: "Password123" }
 *     responses:
 *       201:
 *         description: Utente registrato con successo
 *       400:
 *         description: Dati non validi
 */
router.post('/register', registerValidation, authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login utente
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: "walter.cavaliere@edu-its.it" }
 *               password: { type: string, example: "Bid2426@" }
 *     responses:
 *       200:
 *         description: Login effettuato con successo
 *       401:
 *         description: Credenziali non valide
 */
router.post('/login', loginValidation, authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', 
  body('email').isEmail().normalizeEmail(), 
  authController.forgotPassword
);
router.post('/reset-password', resetPasswordValidation, authController.resetPassword);

// Routes protette (richiedono autenticazione)
router.use(authMiddleware); // Applica middleware a tutte le route seguenti

router.post('/logout', authController.logout);
router.get('/me', authController.getProfile);
router.put('/profile', 
  body('name').optional().trim().isLength({ min: 2, max: 50 }),
  body('avatar').optional().isURL(),
  authController.updateProfile
);
router.put('/change-password', changePasswordValidation, authController.changePassword);

module.exports = router;