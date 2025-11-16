const express = require('express');
const { body, param } = require('express-validator');
const chatController = require('../controllers/ChatController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Applica autenticazione a tutte le routes
router.use(authMiddleware);

// Validazione ID MongoDB
const validateObjectId = param('eventId').isMongoId().withMessage('ID evento non valido');
const validateMessageId = param('messageId').isMongoId().withMessage('ID messaggio non valido');

// Validazione per invio messaggio
const sendMessageValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Messaggio deve essere tra 1 e 1000 caratteri'),
  body('type')
    .optional()
    .isIn(['text', 'image'])
    .withMessage('Tipo messaggio non valido')
];

// Validazione per modifica messaggio
const editMessageValidation = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Messaggio deve essere tra 1 e 1000 caratteri')
];

// Validazione per impostazioni chat
const chatSettingsValidation = [
  body('allowChat')
    .isBoolean()
    .withMessage('allowChat deve essere un booleano')
];

/**
 * @swagger
 * /api/chat/events/{eventId}/messages:
 *   get:
 *     summary: Ottieni messaggi di un evento
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID dell'evento
 *     responses:
 *       200:
 *         description: Lista messaggi
 *       401:
 *         description: Non autenticato
 *       404:
 *         description: Evento non trovato
 */
router.get('/events/:eventId/messages', validateObjectId, chatController.getEventMessages);

/**
 * @swagger
 * /api/chat/events/{eventId}/messages:
 *   post:
 *     summary: Invia un messaggio in chat
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
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
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 example: "Ciao a tutti! Ci vediamo domani!"
 *               type:
 *                 type: string
 *                 enum: [text, image]
 *                 default: text
 *     responses:
 *       201:
 *         description: Messaggio inviato
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autenticato
 *       404:
 *         description: Evento non trovato
 */
router.post('/events/:eventId/messages', validateObjectId, sendMessageValidation, chatController.sendMessage);

/**
 * @swagger
 * /api/chat/messages/{messageId}:
 *   put:
 *     summary: Modifica un messaggio
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del messaggio
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 example: "Messaggio modificato"
 *     responses:
 *       200:
 *         description: Messaggio modificato
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non sei l'autore del messaggio
 *       404:
 *         description: Messaggio non trovato
 */
router.put('/messages/:messageId', validateMessageId, editMessageValidation, chatController.editMessage);

/**
 * @swagger
 * /api/chat/messages/{messageId}:
 *   delete:
 *     summary: Elimina un messaggio
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del messaggio
 *     responses:
 *       200:
 *         description: Messaggio eliminato
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non sei l'autore del messaggio
 *       404:
 *         description: Messaggio non trovato
 */
router.delete('/messages/:messageId', validateMessageId, chatController.deleteMessage);

/**
 * @swagger
 * /api/chat/events/{eventId}/participants:
 *   get:
 *     summary: Lista partecipanti alla chat
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID dell'evento
 *     responses:
 *       200:
 *         description: Lista partecipanti
 *       401:
 *         description: Non autenticato
 *       404:
 *         description: Evento non trovato
 */
router.get('/events/:eventId/participants', validateObjectId, chatController.getChatParticipants);

/**
 * @swagger
 * /api/chat/events/{eventId}/settings:
 *   post:
 *     summary: Modifica impostazioni chat
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
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
 *               - allowChat
 *             properties:
 *               allowChat:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Impostazioni aggiornate
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Solo il creatore può modificare le impostazioni
 *       404:
 *         description: Evento non trovato
 */
router.post('/events/:eventId/settings', validateObjectId, chatSettingsValidation, chatController.updateChatSettings);

module.exports = router;