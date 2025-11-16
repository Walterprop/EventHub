const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Evento di riferimento
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  // Utente che ha inviato il messaggio
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Contenuto messaggio
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  // Tipo messaggio
  type: {
    type: String,
    enum: ['text', 'image', 'system'],
    default: 'text'
  },
  // File allegato (per immagini)
  attachment: {
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String
  },
  // Status messaggio
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  // Messaggi di sistema (es: "Mario si è iscritto all'evento")
  systemData: {
    action: String, // 'user_joined', 'user_left', 'event_updated'
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true
});

// Index per performance
messageSchema.index({ eventId: 1, createdAt: -1 });
messageSchema.index({ userId: 1 });
messageSchema.index({ type: 1 });

// Metodo per creare messaggio di sistema
messageSchema.statics.createSystemMessage = function(eventId, action, targetUserId, customContent) {
  const systemMessages = {
    'user_joined': 'si è iscritto all\'evento',
    'user_left': 'ha cancellato l\'iscrizione',
    'event_updated': 'ha aggiornato l\'evento'
  };
  
  return this.create({
    eventId,
    userId: targetUserId,
    content: customContent || systemMessages[action] || 'Azione eseguita',
    type: 'system',
    systemData: {
      action,
      targetUser: targetUserId
    }
  });
};

module.exports = mongoose.model('Message', messageSchema);