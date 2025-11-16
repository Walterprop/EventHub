const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { getOnlineUsersCount } = require('../utils/socketHelpers');

const router = express.Router();

/**
 * @swagger
 * /api/socket/stats:
 *   get:
 *     summary: Statistiche connessioni WebSocket in tempo reale
 *     tags: [Socket]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiche WebSocket
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
 *                     connectedUsers:
 *                       type: number
 *                       example: 42
 *                     connectedUserIds:
 *                       type: array
 *                       items:
 *                         type: string
 *                     serverUptime:
 *                       type: number
 *                       description: Uptime server in secondi
 *                     memoryUsage:
 *                       type: object
 *       401:
 *         description: Non autenticato
 *       503:
 *         description: Socket.io non disponibile
 */
router.get('/stats', authMiddleware, (req, res) => {
  try {
    const socketHandler = req.app.get('socketHandler');
    
    if (!socketHandler) {
      return res.status(503).json({
        success: false,
        message: 'Socket.io non disponibile'
      });
    }

    const stats = {
      connectedUsers: socketHandler.getConnectedUsersCount(),
      connectedUserIds: socketHandler.getConnectedUsers(),
      serverUptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Errore nel recuperare le statistiche',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/socket/user/{userId}/online:
 *   get:
 *     summary: Verifica se un utente è online
 *     tags: [Socket]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID dell'utente da controllare
 *     responses:
 *       200:
 *         description: Status online utente
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
 *                     userId:
 *                       type: string
 *                     isOnline:
 *                       type: boolean
 *                       example: true
 *                     checkedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Non autenticato
 */
router.get('/user/:userId/online', authMiddleware, (req, res) => {
  try {
    const { userId } = req.params;
    const socketHandler = req.app.get('socketHandler');
    
    const isOnline = socketHandler ? socketHandler.isUserOnline(userId) : false;
    
    res.json({
      success: true,
      data: {
        userId,
        isOnline,
        checkedAt: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Errore nella verifica dello status',
      error: error.message
    });
  }
});

module.exports = router;