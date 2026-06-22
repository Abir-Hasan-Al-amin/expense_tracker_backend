const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['cash', 'bank', 'credit_card', 'savings', 'other'], default: 'cash' },
  balance: { type: Number, default: 0 },
  currency: { type: String, default: 'USD', trim: true, uppercase: true },
  color: { type: String, default: '#6366f1' },
}, { timestamps: true });

module.exports = mongoose.model('Wallet', walletSchema);
