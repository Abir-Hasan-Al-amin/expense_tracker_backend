const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const Loan = require('../models/Loan');
const SavingsGoal = require('../models/SavingsGoal');
const auth = require('../middleware/auth');

router.use(auth);

function toCSV(headers, rows) {
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(row.map(escape).join(','));
  return lines.join('\n');
}

router.get('/expenses', async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    const filter = { user: req.user.id };
    if (type) filter.type = type;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    const expenses = await Expense.find(filter).populate('category wallet').sort({ date: -1 });
    const headers = ['Date', 'Title', 'Type', 'Amount', 'Category', 'Wallet', 'Tags', 'Note'];
    const rows = expenses.map(e => [
      new Date(e.date).toISOString().slice(0, 10),
      e.title,
      e.type,
      e.amount,
      e.category?.name || '',
      e.wallet?.name || '',
      (e.tags || []).join('; '),
      e.note || '',
    ]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="expenses.csv"');
    res.send(toCSV(headers, rows));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/loans', async (req, res) => {
  try {
    const loans = await Loan.find({ user: req.user.id }).sort({ createdAt: -1 });
    const headers = ['Date', 'Type', 'Person', 'Contact', 'Total Amount', 'Remaining', 'Status', 'Due Date', 'Note'];
    const rows = loans.map(l => [
      new Date(l.createdAt).toISOString().slice(0, 10),
      l.type,
      l.personName,
      l.personContact || '',
      l.amount,
      l.remainingAmount,
      l.status,
      l.dueDate ? new Date(l.dueDate).toISOString().slice(0, 10) : '',
      l.note || '',
    ]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="loans.csv"');
    res.send(toCSV(headers, rows));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/savings', async (req, res) => {
  try {
    const goals = await SavingsGoal.find({ user: req.user.id }).sort({ createdAt: -1 });
    const headers = ['Title', 'Target Amount', 'Current Amount', 'Progress %', 'Status', 'Deadline'];
    const rows = goals.map(g => [
      g.title,
      g.targetAmount,
      g.currentAmount,
      Math.round((g.currentAmount / g.targetAmount) * 100),
      g.status,
      g.deadline ? new Date(g.deadline).toISOString().slice(0, 10) : '',
    ]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="savings.csv"');
    res.send(toCSV(headers, rows));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
