const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: [0.01, 'Amount must be greater than 0'] },
  type: { type: String, enum: ['expense', 'income'], required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  date: { type: Date, default: Date.now },
  note: { type: String, trim: true, default: '' },
  isRecurring: { type: Boolean, default: false },
  recurringFrequency: { type: String, enum: [null, 'daily', 'weekly', 'monthly'], default: null },
  recurringNextDate: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
