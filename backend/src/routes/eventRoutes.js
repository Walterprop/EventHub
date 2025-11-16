const express = require('express');
const { body, param } = require('express-validator');
const eventController = require('../controllers/EventController');
const authMiddleware = require('../middleware/authMiddleware');
const optionalAuthMiddleware = require('../middleware/optionalAuthMiddleware');
const transformEventData = require('../middleware/transformEventData');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Events
 *   description: API per la gestione degli eventi
 */

// Validazioni per creazione/aggiornamento evento
const eventValidation = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Titolo deve essere tra 3 e 100 caratteri'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Descrizione deve essere tra 10 e 2000 caratteri'),
  body('category')
    .isIn([
      'conferenza', 'workshop', 'concerto', 'sport', 
      'networking', 'festa', 'formazione', 'charity', 
      'arte', 'tecnologia', 'business', 'altro'
    ])
    .withMessage('Categoria non valida'),
  body('location.address')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Indirizzo richiesto'),
  body('location.city')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Città richiesta'),
  body('date.start')
    .isISO8601()
    .withMessage('Data inizio non valida')
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error('Data inizio deve essere futura');
      }
      return true;
    }),
  body('date.end')
    .isISO8601()
    .withMessage('Data fine non valida')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.date.start)) {
        throw new Error('Data fine deve essere dopo la data di inizio');
      }
      return true;
    }),
  body('capacity')
    .isInt({ min: 1, max: 10000 })
    .withMessage('Capienza deve essere tra 1 e 10000'),
  body('price.amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Prezzo deve essere positivo'),
  body('image')
    .optional()
    .isURL()
    .withMessage('URL immagine non valido')
];

// Validazioni per segnalazione
const reportValidation = [
  body('reason')
    .isIn([
      'contenuto-inappropriato', 'spam', 'informazioni-false',
      'evento-cancellato', 'violazione-termini', 'contenuto-offensivo',
      'truffa', 'altro'
    ])
    .withMessage('Motivo segnalazione non valido'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Descrizione troppo lunga (max 1000 caratteri)')
];

// Validazione ID MongoDB
const validateObjectId = param('id').isMongoId().withMessage('ID non valido');

// Routes pubbliche (con auth opzionale per info aggiuntive)

/**
 * @swagger
 * /api/events/stats:
 *   get:
 *     summary: Ottieni statistiche eventi
 *     tags: [Events]
 *     responses:
 *       200:
 *         description: Statistiche eventi
 */
router.get('/stats', eventController.getStats);

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Lista eventi pubblici approvati
 *     tags: [Events]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Numero pagina
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Numero risultati per pagina
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filtra per categoria
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filtra per città
 *     responses:
 *       200:
 *         description: Lista eventi
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
 *                     pagination:
 *                       type: object
 */
router.get('/', optionalAuthMiddleware, eventController.getEvents);

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: Dettagli di un evento
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID dell'evento
 *     responses:
 *       200:
 *         description: Dettagli evento
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
 *                     event:
 *                       $ref: '#/components/schemas/Event'
 *       404:
 *         description: Evento non trovato
 */
router.get('/:id', validateObjectId, optionalAuthMiddleware, eventController.getEventById);

// Routes protette (richiedono autenticazione)
router.use(authMiddleware);

// CRUD Eventi

/**
 * @swagger
 * /api/events:
 *   post:
 *     summary: Crea nuovo evento
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, category, date, time, location, city, maxParticipants]
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Workshop JavaScript Avanzato"
 *               description:
 *                 type: string
 *                 example: "Workshop su ES6+, async/await e design patterns"
 *               category:
 *                 type: string
 *                 enum: [conferenza, workshop, concerto, sport, networking, festa, formazione, charity, arte, tecnologia, business, altro]
 *                 example: "formazione"
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2025-11-20"
 *               time:
 *                 type: string
 *                 example: "14:30"
 *               location:
 *                 type: string
 *                 example: "Via Roma 123"
 *               city:
 *                 type: string
 *                 example: "Milano"
 *               maxParticipants:
 *                 type: integer
 *                 example: 50
 *               price:
 *                 type: number
 *                 example: 25
 *     responses:
 *       201:
 *         description: Evento creato (in attesa di approvazione admin)
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autenticato
 */
router.post('/', transformEventData, eventValidation, eventController.createEvent);

/**
 * @swagger
 * /api/events/{id}:
 *   put:
 *     summary: Modifica un evento
 *     tags: [Events]
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
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               time:
 *                 type: string
 *               location:
 *                 type: string
 *               city:
 *                 type: string
 *               maxParticipants:
 *                 type: integer
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Evento aggiornato
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non sei il creatore dell'evento
 *       404:
 *         description: Evento non trovato
 */
router.put('/:id', validateObjectId, transformEventData, eventValidation, eventController.updateEvent);

/**
 * @swagger
 * /api/events/{id}:
 *   delete:
 *     summary: Elimina un evento
 *     tags: [Events]
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
 *         description: Evento eliminato
 *       401:
 *         description: Non autenticato
 *       403:
 *         description: Non sei il creatore dell'evento
 *       404:
 *         description: Evento non trovato
 */
router.delete('/:id', validateObjectId, eventController.deleteEvent);

/**
 * @swagger
 * /api/events/{id}/join:
 *   post:
 *     summary: Iscriviti a un evento
 *     tags: [Events]
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
 *         description: Iscrizione completata
 *       400:
 *         description: Evento pieno o già iscritto
 *       401:
 *         description: Non autenticato
 *       404:
 *         description: Evento non trovato
 */
router.post('/:id/join', validateObjectId, eventController.joinEvent);

/**
 * @swagger
 * /api/events/{id}/leave:
 *   post:
 *     summary: Annulla iscrizione a un evento
 *     tags: [Events]
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
 *         description: Iscrizione annullata
 *       400:
 *         description: Non sei iscritto a questo evento
 *       401:
 *         description: Non autenticato
 *       404:
 *         description: Evento non trovato
 */
router.post('/:id/leave', validateObjectId, eventController.leaveEvent);

/**
 * @swagger
 * /api/events/{id}/report:
 *   post:
 *     summary: Segnala un evento
 *     tags: [Events]
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
 *                 enum: [contenuto-inappropriato, spam, informazioni-false, evento-cancellato, violazione-termini, contenuto-offensivo, truffa, altro]
 *                 example: "spam"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 example: "Questo evento è duplicato e spam"
 *     responses:
 *       201:
 *         description: Segnalazione inviata
 *       400:
 *         description: Dati non validi
 *       401:
 *         description: Non autenticato
 *       404:
 *         description: Evento non trovato
 */
router.post('/:id/report', validateObjectId, reportValidation, eventController.reportEvent);

/**
 * @swagger
 * /api/events/user/created:
 *   get:
 *     summary: Eventi creati dall'utente
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista eventi creati
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
 */
router.get('/user/created', eventController.getUserCreatedEvents);

/**
 * @swagger
 * /api/events/user/joined:
 *   get:
 *     summary: Eventi a cui l'utente è iscritto
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista eventi a cui l'utente partecipa
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
 */
router.get('/user/joined', eventController.getUserJoinedEvents);

module.exports = router;