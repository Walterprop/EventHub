const mongoose = require('mongoose');

const eventReportSchema = new mongoose.Schema({
  // Evento segnalato
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  // Utente che ha fatto la segnalazione
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Motivo segnalazione
  reason: {
    type: String,
    enum: [
      'contenuto-inappropriato',
      'spam',
      'informazioni-false',
      'evento-cancellato',
      'violazione-termini',
      'contenuto-offensivo',
      'truffa',
      'altro'
    ],
    required: true
  },
  // Descrizione dettagliata
  description: {
    type: String,
    maxlength: 1000,
    trim: true
  },
  // Status della segnalazione
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending'
  },
  // Review admin
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  adminNotes: {
    type: String,
    maxlength: 500
  },
  // Azione intrapresa
  actionTaken: {
    type: String,
    enum: [
      'none',
      'warning_sent',
      'event_removed',
      'user_warned',
      'user_suspended',
      'event_edited'
    ],
    default: 'none'
  }
}, {
  timestamps: true
});

// Index per performance
eventReportSchema.index({ eventId: 1, status: 1 });
eventReportSchema.index({ reportedBy: 1 });
eventReportSchema.index({ status: 1, createdAt: -1 });
eventReportSchema.index({ reviewedBy: 1 });

// Metodo statico per ottenere statistiche segnalazioni
eventReportSchema.statics.getReportStats = function(eventId) {
  return this.aggregate([
    { $match: { eventId: mongoose.Types.ObjectId(eventId) } },
    {
      $group: {
        _id: '$reason',
        count: { $sum: 1 },
        latestReport: { $max: '$createdAt' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

module.exports = mongoose.model('EventReport', eventReportSchema);