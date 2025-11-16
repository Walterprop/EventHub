const { Event, User, Notification, EventReport, Message } = require('../models');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

class EventController {
  // GET /api/events - Ottenere tutti gli eventi pubblici con filtri
  async getEvents(req, res) {
    try {
      const {
        page = 1,
        limit = 12,
        category,
        city,
        startDate,
        endDate,
        search,
        sortBy = 'date.start'
      } = req.query;

      // Costruire query filtri
      const query = { status: 'approved' };

      if (category) query.category = category;
      if (city) query['location.city'] = new RegExp(city, 'i');
      if (startDate || endDate) {
        query['date.start'] = {};
        if (startDate) query['date.start'].$gte = new Date(startDate);
        if (endDate) query['date.start'].$lte = new Date(endDate);
      }
      if (search) {
        query.$text = { $search: search };
      }

      // Paginazione
      const skip = (page - 1) * limit;

      // Eseguire query
      const events = await Event.find(query)
        .populate('createdBy', 'name avatar')
        .sort(sortBy)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Contare totale per paginazione
      const total = await Event.countDocuments(query);

      // Aggiungere conteggio partecipanti attivi
      const eventsWithCounts = events.map(event => ({
        ...event,
        activeParticipantsCount: event.participants.filter(p => p.status === 'confirmed').length
      }));

      res.json({
        success: true,
        data: {
          events: eventsWithCounts,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalEvents: total,
            hasNext: page * limit < total,
            hasPrev: page > 1
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel recuperare gli eventi',
        error: error.message
      });
    }
  }

  // GET /api/events/:id - Ottenere dettagli evento singolo
  async getEventById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const event = await Event.findById(id)
        .populate('createdBy', 'name avatar email')
        .populate('participants.user', 'name avatar')
        .lean();

      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Evento non trovato'
        });
      }

      // Verificare se l'utente può vedere l'evento
      if (event.status !== 'approved' && 
          (!userId || (event.createdBy._id.toString() !== userId && req.user.role !== 'admin'))) {
        return res.status(403).json({
          success: false,
          message: 'Non hai i permessi per visualizzare questo evento'
        });
      }

      // Aggiungere informazioni utente
      const eventWithUserInfo = {
        ...event,
        activeParticipantsCount: event.participants.filter(p => p.status === 'confirmed').length,
        isUserParticipant: userId ? event.participants.some(p => 
          p.user._id.toString() === userId && p.status === 'confirmed'
        ) : false,
        isUserCreator: userId ? event.createdBy._id.toString() === userId : false,
        canUserReport: userId ? !event.reports?.some(r => r.reportedBy.toString() === userId) : false
      };

      // Incrementare view count
      await Event.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });

      res.json({
        success: true,
        data: eventWithUserInfo
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel recuperare l\'evento',
        error: error.message
      });
    }
  }

  // POST /api/events - Creare nuovo evento
  async createEvent(req, res) {
    try {
      console.log('📝 Tentativo creazione evento:', req.body);
      
      // Validazione input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('❌ Errori validazione:', errors.array());
        return res.status(400).json({
          success: false,
          message: 'Dati non validi',
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      
      // I dati sono già stati trasformati dal middleware
      const eventData = {
        ...req.body,
        createdBy: userId,
        status: 'pending' // Tutti gli eventi devono essere approvati
      };
      
      console.log('✅ Dati pronti per il modello:', eventData);

      const event = new Event(eventData);
      await event.save();

      console.log('✅ Evento salvato con ID:', event._id, 'status:', event.status);

      // Popolare dati per risposta
      await event.populate('createdBy', 'name avatar');

      // Aggiornare statistiche utente
      await User.findByIdAndUpdate(userId, { $inc: { eventsCreated: 1 } });

      // Inviare notifica agli admin per nuovo evento
      try {
        console.log('🔍 Cercando utenti admin per notifiche...');
        const adminUsers = await User.find({ role: 'admin' }).select('_id');
        console.log(`👥 Trovati ${adminUsers.length} admin:`, adminUsers.map(u => u._id));
        const adminIds = adminUsers.map(admin => admin._id);
        
        for (const adminId of adminIds) {
          console.log(`📤 Creando notifica per admin: ${adminId}`);
          const notification = await Notification.create({
            recipient: adminId,
            type: 'system',
            title: 'Nuovo Evento da Approvare',
            message: `L'evento "${event.title}" è in attesa di approvazione`,
            data: {
              eventId: event._id,
              eventTitle: event.title,
              organizerName: req.user.name
            }
          });
          console.log(`✅ Notifica creata con ID: ${notification._id}`);
        }
      } catch (notificationError) {
        console.error('❌ Error sending admin notifications:', notificationError);
        // Non bloccare la creazione dell'evento per errori di notifica
      }

      res.status(201).json({
        success: true,
        message: 'Evento creato con successo. In attesa di approvazione.',
        data: event
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nella creazione dell\'evento',
        error: error.message
      });
    }
  }

  // PUT /api/events/:id - Aggiornare evento
  async updateEvent(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';

      const event = await Event.findById(id);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Evento non trovato'
        });
      }

      // Verificare permessi
      if (!isAdmin && event.createdBy.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Non hai i permessi per modificare questo evento'
        });
      }

      // Aggiornare evento
      const updatedEvent = await Event.findByIdAndUpdate(
        id,
        { ...req.body },
        { new: true, runValidators: true }
      ).populate('createdBy', 'name avatar');

      // Notificare partecipanti del cambiamento
      const participants = event.participants
        .filter(p => p.status === 'confirmed')
        .map(p => p.user);

      for (const participantId of participants) {
        await Notification.create({
          recipient: participantId,
          type: 'event_updated',
          title: 'Evento aggiornato',
          message: `L'evento "${event.title}" è stato aggiornato`,
          data: {
            eventId: id,
            eventTitle: event.title,
            actionUrl: `/events/${id}`
          }
        });
      }

      // Creare messaggio di sistema in chat
      await Message.createSystemMessage(id, 'event_updated', userId);

      res.json({
        success: true,
        message: 'Evento aggiornato con successo',
        data: updatedEvent
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nell\'aggiornamento dell\'evento',
        error: error.message
      });
    }
  }

  // DELETE /api/events/:id - Eliminare evento
  async deleteEvent(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';

      const event = await Event.findById(id);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Evento non trovato'
        });
      }

      // Verificare permessi
      if (!isAdmin && event.createdBy.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Non hai i permessi per eliminare questo evento'
        });
      }

      await Event.findByIdAndDelete(id);

      // Aggiornare statistiche utente
      await User.findByIdAndUpdate(event.createdBy, { $inc: { eventsCreated: -1 } });

      res.json({
        success: true,
        message: 'Evento eliminato con successo'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nell\'eliminazione dell\'evento',
        error: error.message
      });
    }
  }

  // POST /api/events/:id/join - Iscriversi a un evento
  async joinEvent(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const event = await Event.findById(id);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Evento non trovato'
        });
      }

      // Verificare se evento è approvato
      if (event.status !== 'approved') {
        return res.status(403).json({
          success: false,
          message: 'Non puoi iscriverti a un evento non approvato'
        });
      }

      // Verificare se evento è passato
      if (event.date.start < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Non puoi iscriverti a un evento già iniziato'
        });
      }

      // Verificare se utente è il creatore
      if (event.createdBy.toString() === userId) {
        return res.status(400).json({
          success: false,
          message: 'Non puoi iscriverti al tuo stesso evento'
        });
      }

      try {
        const joined = event.addParticipant(userId);
        if (!joined) {
          return res.status(400).json({
            success: false,
            message: 'Sei già iscritto a questo evento'
          });
        }

        await event.save();

        // Aggiornare statistiche utente
        await User.findByIdAndUpdate(userId, { $inc: { eventsAttended: 1 } });

        // Creare notifica per il creatore dell'evento
        await Notification.createUserJoinedNotification(
          event.createdBy,
          userId,
          id,
          event.title
        );

        // Creare messaggio di sistema in chat
        await Message.createSystemMessage(id, 'user_joined', userId);

        res.json({
          success: true,
          message: 'Iscrizione effettuata con successo',
          data: {
            activeParticipantsCount: event.activeParticipantsCount + 1
          }
        });
      } catch (error) {
        if (error.message === 'Evento al completo') {
          return res.status(400).json({
            success: false,
            message: 'Evento al completo'
          });
        }
        throw error;
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nell\'iscrizione all\'evento',
        error: error.message
      });
    }
  }

  // POST /api/events/:id/leave - Cancellare iscrizione
  async leaveEvent(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const event = await Event.findById(id);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Evento non trovato'
        });
      }

      const left = event.removeParticipant(userId);
      if (!left) {
        return res.status(400).json({
          success: false,
          message: 'Non risulti iscritto a questo evento'
        });
      }

      await event.save();

      // Aggiornare statistiche utente
      await User.findByIdAndUpdate(userId, { $inc: { eventsAttended: -1 } });

      // Creare notifica per il creatore dell'evento
      await Notification.createUserLeftNotification(
        event.createdBy,
        userId,
        id,
        event.title
      );

      // Creare messaggio di sistema in chat
      await Message.createSystemMessage(id, 'user_left', userId);

      res.json({
        success: true,
        message: 'Iscrizione cancellata con successo',
        data: {
          activeParticipantsCount: event.activeParticipantsCount - 1
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nella cancellazione dell\'iscrizione',
        error: error.message
      });
    }
  }

  // POST /api/events/:id/report - Segnalare evento
  async reportEvent(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { reason, description } = req.body;

      const event = await Event.findById(id);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Evento non trovato'
        });
      }

      // Verificare se utente ha già segnalato
      const existingReport = await EventReport.findOne({
        eventId: id,
        reportedBy: userId
      });

      if (existingReport) {
        return res.status(400).json({
          success: false,
          message: 'Hai già segnalato questo evento'
        });
      }

      // Creare segnalazione
      const report = new EventReport({
        eventId: id,
        reportedBy: userId,
        reason,
        description
      });

      await report.save();

      // Aggiornare contatore nell'evento
      const reportAdded = event.addReport(userId, reason, description);
      await event.save();

      // Verificare soglia segnalazioni (5 di default)
      const REPORT_THRESHOLD = process.env.REPORT_THRESHOLD || 5;
      
      if (event.reportCount >= REPORT_THRESHOLD) {
        // Notificare tutti gli admin
        const admins = await User.find({ role: 'admin', isBlocked: false });
        
        for (const admin of admins) {
          await Notification.createEventReportedNotification(
            admin._id,
            id,
            event.title,
            event.reportCount,
            reason
          );
        }
      }

      res.json({
        success: true,
        message: 'Segnalazione inviata con successo',
        data: {
          reportCount: event.reportCount
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nell\'invio della segnalazione',
        error: error.message
      });
    }
  }

  // GET /api/events/user/created - Eventi creati dall'utente
  async getUserCreatedEvents(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      const skip = (page - 1) * limit;

      const events = await Event.find({ createdBy: userId })
        .populate('createdBy', 'name avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const total = await Event.countDocuments({ createdBy: userId });

      const eventsWithCounts = events.map(event => ({
        ...event,
        activeParticipantsCount: event.participants.filter(p => p.status === 'confirmed').length
      }));

      res.json({
        success: true,
        data: {
          events: eventsWithCounts,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalEvents: total
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel recuperare gli eventi creati',
        error: error.message
      });
    }
  }

  // GET /api/events/user/joined - Eventi a cui l'utente è iscritto
  async getUserJoinedEvents(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10 } = req.query;

      const skip = (page - 1) * limit;

      const events = await Event.find({
        'participants.user': userId,
        'participants.status': 'confirmed'
      })
        .populate('createdBy', 'name avatar')
        .sort({ 'date.start': 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const total = await Event.countDocuments({
        'participants.user': userId,
        'participants.status': 'confirmed'
      });

      const eventsWithCounts = events.map(event => ({
        ...event,
        activeParticipantsCount: event.participants.filter(p => p.status === 'confirmed').length
      }));

      res.json({
        success: true,
        data: {
          events: eventsWithCounts,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalEvents: total
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel recuperare gli eventi a cui sei iscritto',
        error: error.message
      });
    }
  }

  // GET /api/events/stats - Statistiche generali
  async getStats(req, res) {
    try {
      // Conteggio eventi approvati
      const totalEvents = await Event.countDocuments({ status: 'approved' });
      
      // Conteggio utenti attivi
      const totalUsers = await User.countDocuments({ isBlocked: false });
      
      // Conteggio città uniche
      const cities = await Event.distinct('location.city', { status: 'approved' });
      const totalCities = cities.length;
      
      // Calcolo rating medio (per ora mock, da implementare quando avremo le recensioni)
      const avgRating = 4.8;

      res.json({
        success: true,
        data: {
          totalEvents,
          totalUsers,
          totalCities,
          avgRating
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel recuperare le statistiche',
        error: error.message
      });
    }
  }
}

module.exports = new EventController();