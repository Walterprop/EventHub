const express = require('express');
const { body, param } = require('express-validator');
const adminController = require('../controllers/AdminController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();

// Applica autenticazione e verifica ruolo admin a tutte le routes
router.use(authMiddleware);
router.use(adminMiddleware);

// Validazione ID MongoDB
const validateObjectId = param('id').isMongoId().withMessage('ID non valido');

// Validazione per rifiuto evento
const rejectEventValidation = [
  body('reason')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Motivo deve essere tra 10 e 500 caratteri')
];

// Validazione per review segnalazione
const reviewReportValidation = [
  body('status')
    .isIn(['reviewed', 'resolved', 'dismissed'])
    .withMessage('Status non valido'),
  body('adminNotes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note admin troppo lunghe (max 500 caratteri)'),
  body('actionTaken')
    .isIn([
      'none', 'warning_sent', 'event_removed', 
      'user_warned', 'user_suspended', 'event_edited'
    ])
    .withMessage('Azione non valida')
];

// Validazione per blocco utente
const blockUserValidation = [
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Motivo troppo lungo (max 500 caratteri)')
];

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Dashboard admin completa
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dati dashboard admin
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato (solo admin)
 */
router.get('/dashboard', adminController.getDashboard);

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Statistiche sistema
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiche generali
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato (solo admin)
 */
router.get('/stats', adminController.getStats);

/**
 * @swagger
 * /api/admin/events:
 *   get:
 *     summary: Lista tutti gli eventi (approvati e pending)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista completa eventi
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato (solo admin)
 */
router.get('/events', adminController.getAllEvents);

/**
 * @swagger
 * /api/admin/events/pending:
 *   get:
 *     summary: Eventi in attesa di approvazione
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista eventi pending
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     events:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Event'
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato (solo admin)
 */
router.get('/events/pending', adminController.getPendingEvents);

/**
 * @swagger
 * /api/admin/events/{id}/approve:
 *   put:
 *     summary: Approva un evento
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID dell'evento
 *     responses:
 *       200:
 *         description: Evento approvato
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato (solo admin)
 *       404:
 *         description: Evento non trovato
 */
router.put('/events/:id/approve', validateObjectId, adminController.approveEvent);

/**
 * @swagger
 * /api/admin/events/{id}/reject:
 *   put:
 *     summary: Rifiuta un evento
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID dell'evento
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *                 example: "L'evento non rispetta le policy della piattaforma"
 *     responses:
 *       200:
 *         description: Evento rifiutato
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato (solo admin)
 *       404:
 *         description: Evento non trovato
 */
router.put('/events/:id/reject', validateObjectId, rejectEventValidation, adminController.rejectEvent);

/**
 * @swagger
 * /api/admin/reports:
 *   get:
 *     summary: Lista tutte le segnalazioni
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista segnalazioni
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato (solo admin)
 */
router.get('/reports', adminController.getReports);

/**
 * @swagger
 * /api/admin/reports/{id}/review:
 *   post:
 *     summary: Rivedi una segnalazione
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID della segnalazione
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *               - actionTaken
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [reviewed, resolved, dismissed]
 *                 example: "resolved"
 *               adminNotes:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Evento rimosso per violazione policy"
 *               actionTaken:
 *                 type: string
 *                 enum: [none, warning_sent, event_removed, user_warned, user_suspended, event_edited]
 *                 example: "event_removed"
 *     responses:
 *       200:
 *         description: Segnalazione revisionata
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato (solo admin)
 *       404:
 *         description: Segnalazione non trovata
 */
router.post('/reports/:id/review', validateObjectId, reviewReportValidation, adminController.reviewReport);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Lista tutti gli utenti
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista utenti
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato (solo admin)
 */
router.get('/users', adminController.getUsers);

/**
 * @swagger
 * /api/admin/users/{id}/toggle-role:
 *   put:
 *     summary: Cambia ruolo utente (user/admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID dell'utente
 *     responses:
 *       200:
 *         description: Ruolo modificato
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato (solo admin)
 *       404:
 *         description: Utente non trovato
 */
router.put('/users/:id/toggle-role', validateObjectId, adminController.toggleUserRole);

/**
 * @swagger
 * /api/admin/users/{id}/block:
 *   post:
 *     summary: Blocca un utente
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID dell'utente
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Violazione ripetuta delle policy"
 *     responses:
 *       200:
 *         description: Utente bloccato
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato (solo admin)
 *       404:
 *         description: Utente non trovato
 */
router.post('/users/:id/block', validateObjectId, blockUserValidation, adminController.blockUser);

/**
 * @swagger
 * /api/admin/users/{id}/unblock:
 *   post:
 *     summary: Sblocca un utente
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID dell'utente
 *     responses:
 *       200:
 *         description: Utente sbloccato
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non autorizzato (solo admin)
 *       404:
 *         description: Utente non trovato
 */
router.post('/users/:id/unblock', validateObjectId, adminController.unblockUser);

module.exports = router;