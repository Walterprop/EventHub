// Helper functions per integrare Socket.io nei controller

const sendRealTimeNotification = (req, userId, notification) => {
  const socketHandler = req.app.get('socketHandler');
  if (socketHandler) {
    socketHandler.sendNotificationToUser(userId, notification);
  }
};

const broadcastEventUpdate = (req, eventId, updateType, data) => {
  const socketHandler = req.app.get('socketHandler');
  if (socketHandler) {
    socketHandler.sendEventUpdate(eventId, updateType, data);
  }
};

const broadcastChatMessage = (req, eventId, event, data) => {
  const socketHandler = req.app.get('socketHandler');
  if (socketHandler) {
    socketHandler.broadcastToEventChat(eventId, event, data);
  }
};

const notifyAdmins = (req, event, data) => {
  const socketHandler = req.app.get('socketHandler');
  if (socketHandler) {
    socketHandler.notifyAdmins(event, data);
  }
};

const isUserOnline = (req, userId) => {
  const socketHandler = req.app.get('socketHandler');
  return socketHandler ? socketHandler.isUserOnline(userId) : false;
};

const getOnlineUsersCount = (req) => {
  const socketHandler = req.app.get('socketHandler');
  return socketHandler ? socketHandler.getConnectedUsersCount() : 0;
};

module.exports = {
  sendRealTimeNotification,
  broadcastEventUpdate,
  broadcastChatMessage,
  notifyAdmins,
  isUserOnline,
  getOnlineUsersCount
};