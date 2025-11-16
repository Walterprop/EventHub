const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  category: {
    type: String,
    required: true,
    enum: [
      'conferenza', 'workshop', 'concerto', 'sport', 
      'networking', 'festa', 'formazione', 'charity', 
      'arte', 'tecnologia', 'business', 'altro'
    ]
  },
  location: {
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true,
      default: 'Italia'
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  date: {
    start: {
      type: Date,
      required: true
    },
    end: {
      type: Date,
      required: true
    }
  },
  capacity: {
    type: Number,
    required: true,
    min: 1,
    max: 10000
  },
  price: {
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    currency: {
      type: String,
      default: 'EUR'
    },
    isFree: {
      type: Boolean,
      default: true
    }
  },
  image: {
    type: String,
    default: null
  },
  // Creatore dell'evento
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Partecipanti iscritti
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['confirmed', 'cancelled'],
      default: 'confirmed'
    }
  }],
  // Status approvazione admin
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  // Dettagli approvazione/rifiuto
  moderation: {
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: Date,
    reason: String // Motivo del rifiuto
  },
  // Sistema segnalazioni
  reports: [{
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: [
        'contenuto-inappropriato', 'spam', 'informazioni-false',
        'evento-cancellato', 'violazione-termini', 'altro'
      ]
    },
    description: String,
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }],
  reportCount: {
    type: Number,
    default: 0
  },
  // Statistiche
  viewCount: {
    type: Number,
    default: 0
  },
  // Tag per ricerca
  tags: [String],
  // Impostazioni evento
  settings: {
    allowChat: {
      type: Boolean,
      default: true
    },
    autoApproveParticipants: {
      type: Boolean,
      default: true
    },
    isPrivate: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Index per performance e ricerca
eventSchema.index({ status: 1, 'date.start': 1 });
eventSchema.index({ category: 1, status: 1 });
eventSchema.index({ 'location.city': 1, status: 1 });
eventSchema.index({ createdBy: 1 });
eventSchema.index({ 'participants.user': 1 });
eventSchema.index({ reportCount: 1 });
eventSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Virtual per contare partecipanti attivi
eventSchema.virtual('activeParticipantsCount').get(function() {
  return this.participants.filter(p => p.status === 'confirmed').length;
});

// Virtual per verificare se l'evento è completo
eventSchema.virtual('isFull').get(function() {
  return this.activeParticipantsCount >= this.capacity;
});

// Virtual per verificare se l'evento è passato
eventSchema.virtual('isPast').get(function() {
  return this.date.end < new Date();
});

// Metodo per aggiungere partecipante
eventSchema.methods.addParticipant = function(userId) {
  // Verifica se già iscritto
  const existingParticipant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (existingParticipant) {
    if (existingParticipant.status === 'cancelled') {
      existingParticipant.status = 'confirmed';
      existingParticipant.joinedAt = new Date();
    }
    return false; // Già iscritto
  }
  
  // Verifica capienza
  if (this.isFull) {
    throw new Error('Evento al completo');
  }
  
  this.participants.push({
    user: userId,
    status: 'confirmed'
  });
  
  return true; // Iscrizione avvenuta
};

// Metodo per rimuovere partecipante
eventSchema.methods.removeParticipant = function(userId) {
  const participantIndex = this.participants.findIndex(
    p => p.user.toString() === userId.toString() && p.status === 'confirmed'
  );
  
  if (participantIndex === -1) {
    return false; // Non trovato
  }
  
  this.participants[participantIndex].status = 'cancelled';
  return true; // Cancellazione avvenuta
};

// Metodo per aggiungere segnalazione
eventSchema.methods.addReport = function(userId, reason, description) {
  // Verifica se utente ha già segnalato
  const existingReport = this.reports.find(
    r => r.reportedBy.toString() === userId.toString()
  );
  
  if (existingReport) {
    return false; // Già segnalato
  }
  
  this.reports.push({
    reportedBy: userId,
    reason,
    description
  });
  
  this.reportCount = this.reports.length;
  return true;
};

module.exports = mongoose.model('Event', eventSchema);