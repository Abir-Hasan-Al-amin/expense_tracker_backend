const mongoose = require('mongoose');

const repaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0.01 },
  date: { type: Date, default: Date.now },
  note: { type: String, trim: true, default: '' },
  wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
});

const loanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['borrowed', 'lent'], required: true },
  personName: { type: String, required: true, trim: true },
  personContact: { type: String, trim: true, default: '' },
  amount: { type: Number, required: true, min: 0.01 },
  remainingAmount: { type: Number, required: true },
  dueDate: { type: Date, default: null },
  status: { type: String, enum: ['active', 'partially_paid', 'settled'], default: 'active' },
  note: { type: String, trim: true, default: '' },
  wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
  repayments: [repaymentSchema],
}, { timestamps: true });

loanSchema.index({ user: 1, status: 1 });
loanSchema.index({ user: 1, status: 1, dueDate: 1 });

module.exports = mongoose.model('Loan', loanSchema);
