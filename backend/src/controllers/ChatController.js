const { Message, Event, User } = require('../models');
const { validationResult } = require('express-validator');

class ChatController {
  // GET /api/chat/events/:eventId/messages - Ottenere messaggi di un evento
  async getEventMessages(req, res) {
    try {
      const { eventId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const userId = req.user.id;

      // Verificare se l'utente può accedere alla chat
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Evento non trovato'
        });
      }

      // Verificare permessi di accesso alla chat
      const isCreator = event.createdBy.toString() === userId;
      const isParticipant = event.participants.some(p => 
        p.user.toString() === userId && p.status === 'confirmed'
      );
      const isAdmin = req.user.role === 'admin';

      if (!isCreator && !isParticipant && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Non hai accesso alla chat di questo evento'
        });
      }

      // Verificare se la chat è abilitata
      if (!event.settings.allowChat) {
        return res.status(403).json({
          success: false,
          message: 'Chat disabilitata per questo evento'
        });
      }

      const skip = (page - 1) * limit;

      const messages = await Message.find({
        eventId,
        isDeleted: false
      })
        .populate('userId', 'name avatar')
        .populate('systemData.targetUser', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Invertire l'ordine per avere i messaggi più recenti in fondo
      messages.reverse();

      const total = await Message.countDocuments({
        eventId,
        isDeleted: false
      });

      res.json({
        success: true,
        data: {
          messages,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalMessages: total,
            hasMore: skip + messages.length < total
          },
          eventInfo: {
            title: event.title,
            allowChat: event.settings.allowChat
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel recuperare i messaggi',
        error: error.message
      });
    }
  }

  // POST /api/chat/events/:eventId/messages - Inviare messaggio
  async sendMessage(req, res) {
    try {
      // Validazione input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dati non validi',
          errors: errors.array()
        });
      }

      const { eventId } = req.params;
      const { content, type = 'text' } = req.body;
      const userId = req.user.id;

      // Verificare evento e permessi
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Evento non trovato'
        });
      }

      // Verificare permessi di scrittura
      const isCreator = event.createdBy.toString() === userId;
      const isParticipant = event.participants.some(p => 
        p.user.toString() === userId && p.status === 'confirmed'
      );

      if (!isCreator && !isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Non puoi scrivere in questa chat'
        });
      }

      // Verificare se la chat è abilitata
      if (!event.settings.allowChat) {
        return res.status(403).json({
          success: false,
          message: 'Chat disabilitata per questo evento'
        });
      }

      // Verificare se l'utente è bloccato
      const user = await User.findById(userId);
      if (user.isBlocked) {
        return res.status(403).json({
          success: false,
          message: 'Non puoi inviare messaggi perché il tuo account è bloccato'
        });
      }

      // Creare messaggio
      const message = new Message({
        eventId,
        userId,
        content: content.trim(),
        type
      });

      await message.save();

      // Popolare dati per risposta
      await message.populate('userId', 'name avatar');

      res.status(201).json({
        success: true,
        message: 'Messaggio inviato con successo',
        data: message
      });

      // Qui verrebbe emesso l'evento Socket.io
      // req.io.to(`event-${eventId}`).emit('new_message', message);

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nell\'invio del messaggio',
        error: error.message
      });
    }
  }

  // PUT /api/chat/messages/:messageId - Modificare messaggio
  async editMessage(req, res) {
    try {
      const { messageId } = req.params;
      const { content } = req.body;
      const userId = req.user.id;

      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Messaggio non trovato'
        });
      }

      // Verificare proprietà del messaggio
      if (message.userId.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Non puoi modificare questo messaggio'
        });
      }

      // Verificare se il messaggio può essere modificato (entro 15 minuti)
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      if (message.createdAt < fifteenMinutesAgo) {
        return res.status(400).json({
          success: false,
          message: 'Non puoi modificare messaggi più vecchi di 15 minuti'
        });
      }

      // Verificare che non sia un messaggio di sistema
      if (message.type === 'system') {
        return res.status(400).json({
          success: false,
          message: 'Non puoi modificare messaggi di sistema'
        });
      }

      // Aggiornare messaggio
      message.content = content.trim();
      message.isEdited = true;
      message.editedAt = new Date();

      await message.save();
      await message.populate('userId', 'name avatar');

      res.json({
        success: true,
        message: 'Messaggio modificato con successo',
        data: message
      });

      // Emettere evento Socket.io
      // req.io.to(`event-${message.eventId}`).emit('message_edited', message);

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nella modifica del messaggio',
        error: error.message
      });
    }
  }

  // DELETE /api/chat/messages/:messageId - Cancellare messaggio
  async deleteMessage(req, res) {
    try {
      const { messageId } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';

      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Messaggio non trovato'
        });
      }

      // Verificare permessi di cancellazione
      const isOwner = message.userId.toString() === userId;
      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Non puoi cancellare questo messaggio'
        });
      }

      // Soft delete
      message.isDeleted = true;
      message.deletedAt = new Date();
      await message.save();

      res.json({
        success: true,
        message: 'Messaggio cancellato con successo'
      });

      // Emettere evento Socket.io
      // req.io.to(`event-${message.eventId}`).emit('message_deleted', { messageId });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nella cancellazione del messaggio',
        error: error.message
      });
    }
  }

  // GET /api/chat/events/:eventId/participants - Ottenere partecipanti chat
  async getChatParticipants(req, res) {
    try {
      const { eventId } = req.params;
      const userId = req.user.id;

      const event = await Event.findById(eventId)
        .populate('createdBy', 'name avatar')
        .populate('participants.user', 'name avatar')
        .lean();

      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Evento non trovato'
        });
      }

      // Verificare accesso
      const isCreator = event.createdBy._id.toString() === userId;
      const isParticipant = event.participants.some(p => 
        p.user._id.toString() === userId && p.status === 'confirmed'
      );
      const isAdmin = req.user.role === 'admin';

      if (!isCreator && !isParticipant && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Non hai accesso a queste informazioni'
        });
      }

      // Costruire lista partecipanti
      const participants = [
        {
          ...event.createdBy,
          role: 'creator',
          isOnline: false // TODO: implementare tracking online
        }
      ];

      event.participants
        .filter(p => p.status === 'confirmed')
        .forEach(p => {
          participants.push({
            ...p.user,
            role: 'participant',
            joinedAt: p.joinedAt,
            isOnline: false // TODO: implementare tracking online
          });
        });

      res.json({
        success: true,
        data: {
          participants,
          totalCount: participants.length
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nel recuperare i partecipanti',
        error: error.message
      });
    }
  }

  // POST /api/chat/events/:eventId/settings - Aggiornare impostazioni chat
  async updateChatSettings(req, res) {
    try {
      const { eventId } = req.params;
      const { allowChat } = req.body;
      const userId = req.user.id;

      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Evento non trovato'
        });
      }

      // Solo il creatore o admin possono modificare le impostazioni
      const isCreator = event.createdBy.toString() === userId;
      const isAdmin = req.user.role === 'admin';

      if (!isCreator && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Non hai i permessi per modificare le impostazioni della chat'
        });
      }

      // Aggiornare impostazioni
      event.settings.allowChat = allowChat;
      await event.save();

      res.json({
        success: true,
        message: 'Impostazioni chat aggiornate con successo',
        data: {
          allowChat: event.settings.allowChat
        }
      });

      // Notificare tutti i partecipanti del cambiamento
      // req.io.to(`event-${eventId}`).emit('chat_settings_updated', {
      //   allowChat: event.settings.allowChat
      // });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Errore nell\'aggiornamento delle impostazioni',
        error: error.message
      });
    }
  }
}

module.exports = new ChatController();