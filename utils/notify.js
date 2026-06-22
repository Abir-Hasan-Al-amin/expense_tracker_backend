const Notification = require('../models/Notification');

async function createNotification(userId, type, title, message, relatedId = null, relatedModel = null) {
  if (relatedId) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const exists = await Notification.findOne({ user: userId, type, relatedId, createdAt: { $gte: cutoff } });
    if (exists) return exists;
  }
  return Notification.create({ user: userId, type, title, message, isRead: false, relatedId, relatedModel });
}

module.exports = { createNotification };
