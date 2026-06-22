const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  contact: { type: String, trim: true, default: '' },
  share: { type: Number, required: true, min: 0 },
  isPaid: { type: Boolean, default: false },
  paidAt: { type: Date, default: null },
});

const splitExpenseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  totalAmount: { type: Number, required: true, min: 0.01 },
  wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  date: { type: Date, default: Date.now },
  participants: [participantSchema],
  note: { type: String, trim: true, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('SplitExpense', splitExpenseSchema);
