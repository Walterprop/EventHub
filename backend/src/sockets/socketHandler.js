const jwt = require('jsonwebtoken');
const { User, Message, Notification } = require('../models');

class SocketHandler {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // userId -> socketId
    this.userSockets = new Map();    // socketId -> userId
    
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  // Middleware per autenticazione Socket.io
  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Token mancante'));
        }

        // Verificare token JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user || user.isBlocked) {
          return next(new Error('Utente non autorizzato'));
        }

        // Aggiungere user al socket
        socket.userId = user._id.toString();
        socket.user = user;
        
        next();
      } catch (error) {
        next(new Error('Token non valido'));
      }
    });
  }

  // Setup event handlers
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
      this.handleChatEvents(socket);
      this.handleNotificationEvents(socket);
      this.handleEventUpdates(socket);
      this.handleDisconnection(socket);
    });
  }

  // Gestione connessione utente
  handleConnection(socket) {
    const userId = socket.userId;
    
    // Tracciare utente connesso
    this.connectedUsers.set(userId, socket.id);
    this.userSockets.set(socket.id, userId);

    console.log(`👤 Utente ${socket.user.name} connesso (${socket.id})`);

    // Unire l'utente alle room appropriate
    socket.join(`user-${userId}`);
    
    // Se è admin, unirlo alla room admin
    if (socket.user.role === 'admin') {
      socket.join('admins');
    }

    // Notificare status online agli eventi dell'utente
    this.updateUserOnlineStatus(userId, true);

    // Inviare conteggio notifiche non lette
    this.sendUnreadNotificationsCount(socket);
  }

  // Gestione eventi chat
  handleChatEvents(socket) {
    // Join chat evento
    socket.on('join_event_chat', async (eventId) => {
      try {
        const hasAccess = await this.checkEventChatAccess(socket.userId, eventId);
        if (hasAccess) {
          socket.join(`event-${eventId}`);
          console.log(`💬 ${socket.user.name} si è unito alla chat evento ${eventId}`);
          
          // Notificare altri utenti che è online
          socket.to(`event-${eventId}`).emit('user_joined_chat', {
            userId: socket.userId,
            userName: socket.user.name,
            userAvatar: socket.user.avatar
          });
        }
      } catch (error) {
        socket.emit('error', { message: 'Errore accesso chat' });
      }
    });

    // Leave chat evento
    socket.on('leave_event_chat', (eventId) => {
      socket.leave(`event-${eventId}`);
      socket.to(`event-${eventId}`).emit('user_left_chat', {
        userId: socket.userId,
        userName: socket.user.name
      });
    });

    // Typing indicator
    socket.on('typing_start', (eventId) => {
      socket.to(`event-${eventId}`).emit('user_typing', {
        userId: socket.userId,
        userName: socket.user.name
      });
    });

    socket.on('typing_stop', (eventId) => {
      socket.to(`event-${eventId}`).emit('user_stopped_typing', {
        userId: socket.userId
      });
    });

    // Nuovo messaggio (gestito tramite API HTTP, qui solo broadcast)
    socket.on('new_message', async (data) => {
      const { eventId, messageId } = data;
      
      try {
        const message = await Message.findById(messageId)
          .populate('userId', 'name avatar');
        
        // Broadcast messaggio a tutti nella chat
        this.io.to(`event-${eventId}`).emit('message_received', message);
        
        // Inviare notifica push agli utenti offline
        this.notifyOfflineUsers(eventId, message);
        
      } catch (error) {
        console.error('Errore broadcast messaggio:', error);
      }
    });
  }

  // Gestione eventi notifiche
  handleNotificationEvents(socket) {
    // Marcare notifica come letta
    socket.on('mark_notification_read', async (notificationId) => {
      try {
        await Notification.findOneAndUpdate(
          { _id: notificationId, recipient: socket.userId },
          { isRead: true, readAt: new Date() }
        );
        
        // Aggiornare conteggio non lette
        this.sendUnreadNotificationsCount(socket);
      } catch (error) {
        console.error('Errore marcatura notifica:', error);
      }
    });

    // Richiesta notifiche non lette
    socket.on('get_unread_count', () => {
      this.sendUnreadNotificationsCount(socket);
    });
  }

  // Gestione aggiornamenti eventi real-time
  handleEventUpdates(socket) {
    // Join aggiornamenti evento specifico
    socket.on('watch_event', (eventId) => {
      socket.join(`event-updates-${eventId}`);
    });

    // Stop watching evento
    socket.on('unwatch_event', (eventId) => {
      socket.leave(`event-updates-${eventId}`);
    });
  }

  // Gestione disconnessione
  handleDisconnection(socket) {
    socket.on('disconnect', () => {
      const userId = this.userSockets.get(socket.id);
      
      if (userId) {
        // Rimuovere mappings
        this.connectedUsers.delete(userId);
        this.userSockets.delete(socket.id);
        
        // Aggiornare status offline
        this.updateUserOnlineStatus(userId, false);
        
        console.log(`👋 Utente ${socket.user?.name} disconnesso`);
      }
    });
  }

  // Metodi utility
  async checkEventChatAccess(userId, eventId) {
    try {
      const { Event } = require('../models');
      const event = await Event.findById(eventId);
      
      if (!event || !event.settings.allowChat) {
        return false;
      }

      // Verificare se è creatore o partecipante
      const isCreator = event.createdBy.toString() === userId;
      const isParticipant = event.participants.some(p => 
        p.user.toString() === userId && p.status === 'confirmed'
      );
      
      return isCreator || isParticipant;
    } catch (error) {
      return false;
    }
  }

  updateUserOnlineStatus(userId, isOnline) {
    // Broadcast status a tutte le chat dove l'utente è presente
    this.io.emit('user_status_changed', {
      userId,
      isOnline,
      lastSeen: isOnline ? null : new Date()
    });
  }

  async sendUnreadNotificationsCount(socket) {
    try {
      const count = await Notification.countDocuments({
        recipient: socket.userId,
        isRead: false
      });
      
      socket.emit('unread_notifications_count', { count });
    } catch (error) {
      console.error('Errore conteggio notifiche:', error);
    }
  }

  async notifyOfflineUsers(eventId, message) {
    try {
      const { Event } = require('../models');
      const event = await Event.findById(eventId).populate('participants.user');
      
      // Trovare utenti offline che dovrebbero ricevere notifica
      const offlineUsers = event.participants
        .filter(p => p.status === 'confirmed')
        .filter(p => !this.connectedUsers.has(p.user._id.toString()))
        .map(p => p.user);

      // Creare notifiche per utenti offline
      for (const user of offlineUsers) {
        await Notification.create({
          recipient: user._id,
          sender: message.userId,
          type: 'new_message',
          title: 'Nuovo messaggio',
          message: `${message.userId.name} ha scritto nella chat di ${event.title}`,
          data: {
            eventId,
            messageId: message._id,
            actionUrl: `/events/${eventId}/chat`
          }
        });
      }
    } catch (error) {
      console.error('Errore notifica utenti offline:', error);
    }
  }

  // Metodi pubblici per inviare eventi
  sendNotificationToUser(userId, notification) {
    const socketId = this.connectedUsers.get(userId.toString());
    if (socketId) {
      this.io.to(`user-${userId}`).emit('new_notification', notification);
    }
  }

  sendEventUpdate(eventId, updateType, data) {
    this.io.to(`event-updates-${eventId}`).emit('event_updated', {
      type: updateType,
      data
    });
  }

  broadcastToEventChat(eventId, event, data) {
    this.io.to(`event-${eventId}`).emit(event, data);
  }

  notifyAdmins(event, data) {
    this.io.to('admins').emit(event, data);
  }

  // Statistiche connessioni
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  getConnectedUsers() {
    return Array.from(this.connectedUsers.keys());
  }

  isUserOnline(userId) {
    return this.connectedUsers.has(userId.toString());
  }
}

module.exports = SocketHandler;