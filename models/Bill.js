const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  dueDay: { type: Number, required: true, min: 1, max: 31 },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
  isPaid: { type: Boolean, default: false },
  lastPaidDate: { type: Date, default: null },
  nextDueDate: { type: Date },
  note: { type: String, trim: true, default: '' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

billSchema.index({ user: 1, isActive: 1, isPaid: 1, nextDueDate: 1 });

module.exports = mongoose.model('Bill', billSchema);
