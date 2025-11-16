const { User, Event, EventReport, Notification } = require('../models');
const { validationResult } = require('express-validator');

class AdminController {
  // GET /api/admin/dashboard - Dashboard admin con statistiche
  async getDashboard(req, res) {
    try {
      const [
        totalUsers,
        totalEvents,
        pendingEvents,
        totalReports,
        pendingReports,
        blockedUsers,
        eventsThisMonth,
        usersThisMonth
      ] = await Promise.all([
        User.countDocuments(),
        Event.countDocuments(),
        Event.countDocuments({ status: 'pending' }),
        EventReport.countDocuments(),
        EventReport.countDocuments({ status: 'pending' }),
        User.countDocuments({ isBlocked: true }),
        Event.countDocuments({
          createdAt: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }),
        User.countDocuments({
          createdAt: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        })
      ]);

      // Statistiche eventi per categoria
      const eventsByCategory = await Event.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      // Eventi più segnalati
      const mostReportedEvents = await Event.find({ reportCount: { $gte: 1 } })
        .sort({ reportCount: -1 })
        .limit(5)
        .populate('createdBy', 'name email')
        .select('title reportCount createdBy createdAt');

      res.json({
        success: true,
        data: {
          stats: {
            totalUsers,
            totalEvents,
            pendingEvents,
            totalReports,
            pendingReports,
            blockedUsers,
            eventsThisMonth,
            usersThisMonth
          },
          charts: {
            eventsByCategory,
            mostReportedEvents
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel recuperare la dashboard',
        error: error.message
      });
    }
  }

  // GET /api/admin/events/pending - Eventi in attesa di approvazione
  async getPendingEvents(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const skip = (page - 1) * limit;

      console.log('🔍 Cercando eventi pending...');
      
      const events = await Event.find({ status: 'pending' })
        .populate('createdBy', 'name email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Event.countDocuments({ status: 'pending' });
      
      console.log('📊 Eventi pending trovati:', events.length, 'totale:', total);

      res.json({
        success: true,
        data: {
          events,
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
        message: 'Errore nel recuperare gli eventi pending',
        error: error.message
      });
    }
  }

  // POST /api/admin/events/:id/approve - Approvare evento
  async approveEvent(req, res) {
    try {
      const { id } = req.params;
      const adminId = req.user.id;

      const event = await Event.findById(id);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Evento non trovato'
        });
      }

      if (event.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Evento già processato'
        });
      }

      // Aggiornare evento
      event.status = 'approved';
      event.moderation = {
        reviewedBy: adminId,
        reviewedAt: new Date()
      };

      await event.save();

      // Notificare il creatore
      console.log(`📤 Inviando notifica di approvazione a: ${event.createdBy}`);
      await Notification.createEventModerationNotification(
        event.createdBy,
        id,
        event.title,
        true
      );
      console.log(`✅ Notifica di approvazione inviata`)

      res.json({
        success: true,
        message: 'Evento approvato con successo',
        data: event
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nell\'approvazione dell\'evento',
        error: error.message
      });
    }
  }

  // POST /api/admin/events/:id/reject - Rifiutare evento
  async rejectEvent(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user.id;

      const event = await Event.findById(id);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Evento non trovato'
        });
      }

      if (event.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Evento già processato'
        });
      }

      // Aggiornare evento
      event.status = 'rejected';
      event.moderation = {
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reason
      };

      await event.save();

      // Notificare il creatore
      await Notification.createEventModerationNotification(
        event.createdBy,
        id,
        event.title,
        false,
        reason
      );

      res.json({
        success: true,
        message: 'Evento rifiutato con successo',
        data: event
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel rifiuto dell\'evento',
        error: error.message
      });
    }
  }

  // GET /api/admin/reports - Gestione segnalazioni
  async getReports(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        status = 'pending',
        eventId 
      } = req.query;
      
      const skip = (page - 1) * limit;
      const query = {};

      if (status !== 'all') query.status = status;
      if (eventId) query.eventId = eventId;

      const reports = await EventReport.find(query)
        .populate('eventId', 'title status reportCount')
        .populate('reportedBy', 'name email')
        .populate('reviewedBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await EventReport.countDocuments(query);

      res.json({
        success: true,
        data: {
          reports,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalReports: total
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel recuperare le segnalazioni',
        error: error.message
      });
    }
  }

  // POST /api/admin/reports/:id/review - Processare segnalazione
  async reviewReport(req, res) {
    try {
      const { id } = req.params;
      const { status, adminNotes, actionTaken } = req.body;
      const adminId = req.user.id;

      const report = await EventReport.findById(id)
        .populate('eventId')
        .populate('reportedBy', 'name email');

      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Segnalazione non trovata'
        });
      }

      // Aggiornare segnalazione
      report.status = status;
      report.reviewedBy = adminId;
      report.reviewedAt = new Date();
      report.adminNotes = adminNotes;
      report.actionTaken = actionTaken;

      await report.save();

      // Azioni basate sul tipo di azione intrapresa
      if (actionTaken === 'event_removed') {
        await Event.findByIdAndUpdate(report.eventId._id, { status: 'rejected' });
      } else if (actionTaken === 'user_suspended') {
        await User.findByIdAndUpdate(report.reportedBy._id, { isBlocked: true });
      }

      res.json({
        success: true,
        message: 'Segnalazione processata con successo',
        data: report
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel processare la segnalazione',
        error: error.message
      });
    }
  }

  // GET /api/admin/users - Gestione utenti
  async getUsers(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search, 
        role,
        isBlocked 
      } = req.query;
      
      const skip = (page - 1) * limit;
      const query = {};

      if (search) {
        query.$or = [
          { name: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') }
        ];
      }
      if (role) query.role = role;
      if (isBlocked !== undefined) query.isBlocked = isBlocked === 'true';

      const users = await User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await User.countDocuments(query);

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalUsers: total
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel recuperare gli utenti',
        error: error.message
      });
    }
  }

  // POST /api/admin/users/:id/block - Bloccare utente
  async blockUser(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utente non trovato'
        });
      }

      if (user.role === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Non puoi bloccare un amministratore'
        });
      }

      user.isBlocked = true;
      await user.save();

      // Notificare l'utente
      await Notification.create({
        recipient: id,
        type: 'user_blocked',
        title: 'Account bloccato',
        message: `Il tuo account è stato bloccato${reason ? ': ' + reason : ''}`,
        priority: 'high'
      });

      res.json({
        success: true,
        message: 'Utente bloccato con successo'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel bloccare l\'utente',
        error: error.message
      });
    }
  }

  // POST /api/admin/users/:id/unblock - Sbloccare utente
  async unblockUser(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utente non trovato'
        });
      }

      user.isBlocked = false;
      await user.save();

      // Notificare l'utente
      await Notification.create({
        recipient: id,
        type: 'system',
        title: 'Account sbloccato',
        message: 'Il tuo account è stato riattivato',
        priority: 'normal'
      });

      res.json({
        success: true,
        message: 'Utente sbloccato con successo'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nello sbloccare l\'utente',
        error: error.message
      });
    }
  }

  // GET /api/admin/events - Tutti gli eventi per admin
  async getAllEvents(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        status, 
        search,
        sortBy = 'createdAt'
      } = req.query;
      
      const skip = (page - 1) * limit;
      const query = {};

      if (status && status !== 'all') query.status = status;
      if (search) {
        query.$or = [
          { title: new RegExp(search, 'i') },
          { description: new RegExp(search, 'i') }
        ];
      }

      const events = await Event.find(query)
        .populate('createdBy', 'name email')
        .sort({ [sortBy]: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Event.countDocuments(query);

      const eventsWithCounts = events.map(event => ({
        ...event.toObject(),
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
        message: 'Errore nel recuperare gli eventi',
        error: error.message
      });
    }
  }

  // GET /api/admin/stats - Statistiche rapide per dashboard
  async getStats(req, res) {
    try {
      const [
        totalUsers,
        totalEvents,
        pendingEvents
      ] = await Promise.all([
        User.countDocuments(),
        Event.countDocuments(),
        Event.countDocuments({ status: 'pending' })
      ]);

      res.json({
        success: true,
        data: {
          totalUsers,
          totalEvents,
          pendingEvents
        }
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Errore nel caricamento delle statistiche'
      });
    }
  }

  // PUT /api/admin/users/:id/toggle-role - Cambia ruolo utente
  async toggleUserRole(req, res) {
    try {
      const userId = req.params.id;
      
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utente non trovato'
        });
      }

      // Non permettere di cambiare il proprio ruolo
      if (user._id.toString() === req.user.id) {
        return res.status(400).json({
          success: false,
          message: 'Non puoi modificare il tuo stesso ruolo'
        });
      }

      // Toggle del ruolo
      const newRole = user.role === 'admin' ? 'user' : 'admin';
      user.role = newRole;
      await user.save();

      res.json({
        success: true,
        message: `Ruolo utente aggiornato a ${newRole}`,
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Toggle user role error:', error);
      res.status(500).json({
        success: false,
        message: 'Errore nel cambiamento del ruolo utente'
      });
    }
  }
}

module.exports = new AdminController();3