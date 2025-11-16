const { Notification } = require('../models');

class NotificationService {
  // Creare notifica per iscrizione evento
  static async createUserJoinedNotification(eventCreatorId, joinerUserId, eventId, eventTitle) {
    try {
      const notification = await Notification.create({
        recipient: eventCreatorId,
        sender: joinerUserId,
        type: 'user_joined_event',
        title: 'Nuova iscrizione al tuo evento',
        message: `Un utente si è iscritto al tuo evento "${eventTitle}"`,
        data: {
          eventId,
          eventTitle,
          actionUrl: `/events/${eventId}`
        },
        priority: 'normal'
      });

      return notification;
    } catch (error) {
      console.error('Errore creazione notifica iscrizione:', error);
      throw error;
    }
  }

  // Creare notifica per cancellazione iscrizione
  static async createUserLeftNotification(eventCreatorId, leaverUserId, eventId, eventTitle) {
    try {
      const notification = await Notification.create({
        recipient: eventCreatorId,
        sender: leaverUserId,
        type: 'user_left_event',
        title: 'Cancellazione iscrizione',
        message: `Un utente ha cancellato l'iscrizione al tuo evento "${eventTitle}"`,
        data: {
          eventId,
          eventTitle,
          actionUrl: `/events/${eventId}`
        },
        priority: 'low'
      });

      return notification;
    } catch (error) {
      console.error('Errore creazione notifica cancellazione:', error);
      throw error;
    }
  }

  // Creare notifica per segnalazione evento (admin)
  static async createEventReportedNotification(adminId, eventId, eventTitle, reportCount, reportReason) {
    try {
      const notification = await Notification.create({
        recipient: adminId,
        type: 'event_reported',
        title: '⚠️ Evento segnalato',
        message: `L'evento "${eventTitle}" ha ricevuto ${reportCount} segnalazioni`,
        data: {
          eventId,
          eventTitle,
          reportCount,
          reportReason,
          actionUrl: `/admin/events/${eventId}`
        },
        priority: 'high'
      });

      return notification;
    } catch (error) {
      console.error('Errore creazione notifica segnalazione:', error);
      throw error;
    }
  }

  // Creare notifica per approvazione/rifiuto evento
  static async createEventModerationNotification(userId, eventId, eventTitle, isApproved, reason = null) {
    try {
      const type = isApproved ? 'event_approved' : 'event_rejected';
      const title = isApproved ? '✅ Evento approvato' : '❌ Evento rifiutato';
      const message = isApproved 
        ? `Il tuo evento "${eventTitle}" è stato approvato ed è ora pubblico`
        : `Il tuo evento "${eventTitle}" è stato rifiutato${reason ? ': ' + reason : ''}`;
      
      const notification = await Notification.create({
        recipient: userId,
        type,
        title,
        message,
        data: {
          eventId,
          eventTitle,
          actionUrl: `/events/${eventId}`,
          metadata: reason ? { rejectionReason: reason } : null
        },
        priority: isApproved ? 'normal' : 'high'
      });

      return notification;
    } catch (error) {
      console.error('Errore creazione notifica moderazione:', error);
      throw error;
    }
  }

  // Creare notifica per nuovo messaggio chat
  static async createNewMessageNotification(recipientId, senderId, eventId, eventTitle, messageContent) {
    try {
      const notification = await Notification.create({
        recipient: recipientId,
        sender: senderId,
        type: 'new_message',
        title: 'Nuovo messaggio',
        message: `Nuovo messaggio nella chat di "${eventTitle}"`,
        data: {
          eventId,
          eventTitle,
          messageContent: messageContent.substring(0, 100) + (messageContent.length > 100 ? '...' : ''),
          actionUrl: `/events/${eventId}/chat`
        },
        priority: 'normal'
      });

      return notification;
    } catch (error) {
      console.error('Errore creazione notifica messaggio:', error);
      throw error;
    }
  }

  // Creare notifica di sistema
  static async createSystemNotification(userId, title, message, priority = 'normal') {
    try {
      const notification = await Notification.create({
        recipient: userId,
        type: 'system',
        title,
        message,
        priority
      });

      return notification;
    } catch (error) {
      console.error('Errore creazione notifica sistema:', error);
      throw error;
    }
  }

  // Marcare tutte le notifiche come lette per un utente
  static async markAllAsReadForUser(userId) {
    try {
      const result = await Notification.updateMany(
        { recipient: userId, isRead: false },
        { 
          isRead: true, 
          readAt: new Date() 
        }
      );

      return result.modifiedCount;
    } catch (error) {
      console.error('Errore marcatura notifiche come lette:', error);
      throw error;
    }
  }

  // Ottenere conteggio notifiche non lette
  static async getUnreadCount(userId) {
    try {
      const count = await Notification.countDocuments({
        recipient: userId,
        isRead: false
      });

      return count;
    } catch (error) {
      console.error('Errore conteggio notifiche non lette:', error);
      throw error;
    }
  }

  // Pulizia notifiche vecchie (da eseguire periodicamente)
  static async cleanupOldNotifications(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await Notification.deleteMany({
        createdAt: { $lt: cutoffDate },
        isRead: true
      });

      console.log(`🧹 Pulite ${result.deletedCount} notifiche vecchie`);
      return result.deletedCount;
    } catch (error) {
      console.error('Errore pulizia notifiche vecchie:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;