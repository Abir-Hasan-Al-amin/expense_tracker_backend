const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['loan_due', 'loan_settled', 'goal_milestone', 'goal_completed', 'bill_due', 'bill_overdue', 'budget_exceeded', 'transfer'],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  relatedId: { type: mongoose.Schema.Types.ObjectId },
  relatedModel: { type: String, enum: ['Loan', 'SavingsGoal', 'Bill', 'Budget', 'Wallet'] },
}, { timestamps: true });

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ user: 1, type: 1, relatedId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
