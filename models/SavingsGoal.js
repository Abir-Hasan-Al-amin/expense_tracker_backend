const mongoose = require('mongoose');

const contributionSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0.01 },
  date: { type: Date, default: Date.now },
  note: { type: String, trim: true, default: '' },
  wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
});

const savingsGoalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  targetAmount: { type: Number, required: true, min: 0.01 },
  currentAmount: { type: Number, default: 0 },
  deadline: { type: Date, default: null },
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  icon: { type: String, default: '🎯' },
  contributions: [contributionSchema],
}, { timestamps: true });

module.exports = mongoose.model('SavingsGoal', savingsGoalSchema);
