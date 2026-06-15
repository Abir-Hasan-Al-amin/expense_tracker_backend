const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  amount: { type: Number, required: true, min: [0.01, 'Budget must be greater than 0'] },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true, min: 2000, max: 2100 },
}, { timestamps: true });

budgetSchema.index({ user: 1, category: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
