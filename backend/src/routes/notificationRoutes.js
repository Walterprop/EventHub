const express = require('express');
const { param } = require('express-validator');
const notificationController = require('../controllers/NotificationController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Applica autenticazione a tutte le routes
router.use(authMiddleware);

// Validazione ID MongoDB
const validateObjectId = param('id').isMongoId().withMessage('ID notifica non valido');

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Ottieni tutte le notifiche dell'utente
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista delle notifiche
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
 *                     notifications:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Notification'
 *       401:
 *         description: Non autenticato
 */
router.get('/', notificationController.getUserNotifications);

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: Conta notifiche non lette
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Numero di notifiche non lette
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
 *                     count:
 *                       type: number
 *                       example: 3
 *       401:
 *         description: Non autenticato
 */
router.get('/unread-count', notificationController.getUnreadCount);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   put:
 *     summary: Marca una notifica come letta
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID della notifica
 *     responses:
 *       200:
 *         description: Notifica marcata come letta
 *       401:
 *         description: Non autenticato
 *       404:
 *         description: Notifica non trovata
 */
router.put('/:id/read', validateObjectId, notificationController.markAsRead);

/**
 * @swagger
 * /api/notifications/mark-all-read:
 *   put:
 *     summary: Marca tutte le notifiche come lette
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tutte le notifiche marcate come lette
 *       401:
 *         description: Non autenticato
 */
router.put('/mark-all-read', notificationController.markAllAsRead);

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Elimina una notifica
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID della notifica
 *     responses:
 *       200:
 *         description: Notifica eliminata
 *       401:
 *         description: Non autenticato
 *       404:
 *         description: Notifica non trovata
 */
router.delete('/:id', validateObjectId, notificationController.deleteNotification);

module.exports = router;