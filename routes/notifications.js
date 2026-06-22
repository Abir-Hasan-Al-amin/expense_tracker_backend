const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const Loan = require('../models/Loan');
const Bill = require('../models/Bill');
const auth = require('../middleware/auth');
const { createNotification } = require('../utils/notify');

router.use(auth);

async function generateDueSoonNotifications(userId) {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [loans, bills] = await Promise.all([
    Loan.find({ user: userId, status: { $ne: 'settled' }, dueDate: { $lte: in7Days, $gte: now } }),
    Bill.find({ user: userId, isActive: true, isPaid: false, nextDueDate: { $lte: in3Days, $gte: now } }),
  ]);

  await Promise.all([
    ...loans.map(l =>
      createNotification(
        userId, 'loan_due', 'Loan Due Soon',
        `Your ${l.type === 'borrowed' ? 'debt' : 'loan'} of ${l.remainingAmount} with ${l.personName} is due on ${new Date(l.dueDate).toDateString()}`,
        l._id, 'Loan'
      )
    ),
    ...bills.map(b =>
      createNotification(
        userId, 'bill_due', 'Bill Due Soon',
        `Your bill "${b.title}" of ${b.amount} is due on ${new Date(b.nextDueDate).toDateString()}`,
        b._id, 'Bill'
      )
    ),
  ]);
}

router.get('/', async (req, res) => {
  try {
    await generateDueSoonNotifications(req.user.id);
    const { isRead, limit: rawLimit = 50 } = req.query;
    const limit = Math.min(parseInt(rawLimit) || 50, 100);
    const filter = { user: req.user.id };
    if (isRead !== undefined) filter.isRead = isRead === 'true';
    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(limit);
    const unreadCount = await Notification.countDocuments({ user: req.user.id, isRead: false });
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/read-all', async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, isRead: false }, { isRead: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid notification ID' });
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json(notification);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid notification ID' });
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
