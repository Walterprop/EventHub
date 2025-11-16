const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Destinatario della notifica
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Mittente (può essere null per notifiche di sistema)
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Tipo di notifica
  type: {
    type: String,
    enum: [
      'user_joined_event',      // Qualcuno si è iscritto al tuo evento
      'user_left_event',        // Qualcuno ha cancellato iscrizione
      'event_approved',         // Il tuo evento è stato approvato
      'event_rejected',         // Il tuo evento è stato rifiutato
      'event_reported',         // Un evento è stato segnalato (per admin)
      'event_updated',          // Un evento a cui sei iscritto è stato aggiornato
      'new_message',            // Nuovo messaggio in chat evento
      'user_blocked',           // Utente bloccato (per admin)
      'system'                  // Notifica di sistema
    ],
    required: true
  },
  // Titolo notifica
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  // Messaggio notifica
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  // Dati aggiuntivi basati sul tipo
  data: {
    // Per notifiche eventi
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event'
    },
    eventTitle: String,
    
    // Per notifiche messaggi
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    
    // Per notifiche segnalazioni (admin)
    reportCount: Number,
    reportReason: String,
    
    // URL di destinazione
    actionUrl: String,
    
    // Dati extra in formato JSON
    metadata: mongoose.Schema.Types.Mixed
  },
  // Status notifica
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  
  // Priorità notifica
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  // Per notifiche push/email
  channels: {
    inApp: {
      type: Boolean,
      default: true
    },
    email: {
      type: Boolean,
      default: false
    },
    push: {
      type: Boolean,
      default: false
    }
  },
  
  // Tracking invio
  sentAt: Date,
  emailSent: {
    type: Boolean,
    default: false
  },
  pushSent: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index per performance
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ 'data.eventId': 1 });
notificationSchema.index({ priority: 1, createdAt: -1 });

// Metodo statico per creare notifica iscrizione evento
notificationSchema.statics.createUserJoinedNotification = function(eventCreatorId, joinerUserId, eventId, eventTitle) {
  return this.create({
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
};

// Metodo statico per creare notifica cancellazione iscrizione
notificationSchema.statics.createUserLeftNotification = function(eventCreatorId, leaverUserId, eventId, eventTitle) {
  return this.create({
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
};

// Metodo statico per notifica segnalazione evento (admin)
notificationSchema.statics.createEventReportedNotification = function(adminId, eventId, eventTitle, reportCount, reportReason) {
  return this.create({
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
};

// Metodo statico per notifica approvazione/rifiuto evento
notificationSchema.statics.createEventModerationNotification = function(userId, eventId, eventTitle, isApproved, reason = null) {
  const type = isApproved ? 'event_approved' : 'event_rejected';
  const title = isApproved ? '✅ Evento approvato' : '❌ Evento rifiutato';
  const message = isApproved 
    ? `Il tuo evento "${eventTitle}" è stato approvato ed è ora pubblico`
    : `Il tuo evento "${eventTitle}" è stato rifiutato${reason ? ': ' + reason : ''}`;
  
  return this.create({
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
};

// Metodo per marcare come letta
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);