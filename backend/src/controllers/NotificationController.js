const { Notification } = require('../models');

class NotificationController {
  // GET /api/notifications - Ottenere notifiche utente
  async getUserNotifications(req, res) {
    try {
      const userId = req.user.id;
      const { 
        page = 1, 
        limit = 20, 
        unreadOnly = false,
        type 
      } = req.query;

      const skip = (page - 1) * limit;
      const query = { recipient: userId };

      if (unreadOnly === 'true') query.isRead = false;
      if (type) query.type = type;

      const notifications = await Notification.find(query)
        .populate('sender', 'name avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Notification.countDocuments(query);
      const unreadCount = await Notification.countDocuments({
        recipient: userId,
        isRead: false
      });

      res.json({
        success: true,
        data: {
          notifications,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalNotifications: total
          },
          unreadCount
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel recuperare le notifiche',
        error: error.message
      });
    }
  }

  // PUT /api/notifications/:id/read - Segnare notifica come letta
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const notification = await Notification.findOne({
        _id: id,
        recipient: userId
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notifica non trovata'
        });
      }

      await notification.markAsRead();

      res.json({
        success: true,
        message: 'Notifica segnata come letta',
        data: notification
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel segnare la notifica come letta',
        error: error.message
      });
    }
  }

  // PUT /api/notifications/mark-all-read - Segnare tutte come lette
  async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;

      await Notification.updateMany(
        { recipient: userId, isRead: false },
        { 
          isRead: true, 
          readAt: new Date() 
        }
      );

      res.json({
        success: true,
        message: 'Tutte le notifiche sono state segnate come lette'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel segnare le notifiche come lette',
        error: error.message
      });
    }
  }

  // DELETE /api/notifications/:id - Cancellare notifica
  async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const notification = await Notification.findOneAndDelete({
        _id: id,
        recipient: userId
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notifica non trovata'
        });
      }

      res.json({
        success: true,
        message: 'Notifica cancellata con successo'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nella cancellazione della notifica',
        error: error.message
      });
    }
  }

  // GET /api/notifications/unread-count - Conteggio notifiche non lette
  async getUnreadCount(req, res) {
    try {
      const userId = req.user.id;

      const unreadCount = await Notification.countDocuments({
        recipient: userId,
        isRead: false
      });

      res.json({
        success: true,
        data: { unreadCount }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel contare le notifiche non lette',
        error: error.message
      });
    }
  }
}

module.exports = new NotificationController();