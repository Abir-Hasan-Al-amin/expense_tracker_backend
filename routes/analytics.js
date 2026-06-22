const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Wallet = require('../models/Wallet');
const Loan = require('../models/Loan');
const SavingsGoal = require('../models/SavingsGoal');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/summary', async (req, res) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const targetMonth = month ? parseInt(month) - 1 : now.getMonth();
    const targetYear = year ? parseInt(year) : now.getFullYear();
    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
    const uid = mongoose.Types.ObjectId.createFromHexString(req.user.id);

    const [incomeResult, expenseResult] = await Promise.all([
      Expense.aggregate([
        { $match: { user: uid, type: 'income', date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Expense.aggregate([
        { $match: { user: uid, type: 'expense', date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const totalIncome = incomeResult[0]?.total || 0;
    const totalExpense = expenseResult[0]?.total || 0;

    res.json({
      month: targetMonth + 1,
      year: targetYear,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      incomeCount: incomeResult[0]?.count || 0,
      expenseCount: expenseResult[0]?.count || 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const { month, year, type = 'expense' } = req.query;
    const now = new Date();
    const targetMonth = month ? parseInt(month) - 1 : now.getMonth();
    const targetYear = year ? parseInt(year) : now.getFullYear();
    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
    const uid = mongoose.Types.ObjectId.createFromHexString(req.user.id);

    const breakdown = await Expense.aggregate([
      { $match: { user: uid, type, date: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
      { $unwind: '$category' },
      { $sort: { total: -1 } },
    ]);

    const grandTotal = breakdown.reduce((s, b) => s + b.total, 0);
    const result = breakdown.map(b => ({
      category: b.category,
      total: b.total,
      count: b.count,
      percentage: grandTotal > 0 ? Math.round((b.total / grandTotal) * 100) : 0,
    }));

    res.json({ breakdown: result, total: grandTotal });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/trends', async (req, res) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const targetMonth = month ? parseInt(month) - 1 : now.getMonth();
    const targetYear = year ? parseInt(year) : now.getFullYear();
    const uid = mongoose.Types.ObjectId.createFromHexString(req.user.id);

    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

    const expenses = await Expense.find({
      user: uid,
      date: { $gte: startDate, $lte: endDate },
    }).select('amount type date');

    const dayMap = {};
    for (let d = 1; d <= daysInMonth; d++) dayMap[d] = { day: d, income: 0, expense: 0 };
    for (const e of expenses) {
      const d = new Date(e.date).getDate();
      if (dayMap[d]) dayMap[d][e.type] += e.amount;
    }

    res.json({ trends: Object.values(dayMap), month: targetMonth + 1, year: targetYear });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/net-worth', async (req, res) => {
  try {
    const [wallets, goals, loans] = await Promise.all([
      Wallet.find({ user: req.user.id }),
      SavingsGoal.find({ user: req.user.id, status: 'active' }),
      Loan.find({ user: req.user.id, status: { $ne: 'settled' } }),
    ]);

    const totalWalletBalance = wallets.reduce((s, w) => s + w.balance, 0);
    const totalSavings = goals.reduce((s, g) => s + g.currentAmount, 0);
    const totalOwed = loans.filter(l => l.type === 'borrowed').reduce((s, l) => s + l.remainingAmount, 0);
    const totalLent = loans.filter(l => l.type === 'lent').reduce((s, l) => s + l.remainingAmount, 0);

    res.json({
      totalWalletBalance,
      totalSavings,
      totalOwed,
      totalLent,
      netWorth: totalWalletBalance + totalSavings - totalOwed + totalLent,
      breakdown: {
        wallets: wallets.map(w => ({ name: w.name, balance: w.balance, type: w.type })),
        savingsGoals: goals.map(g => ({ title: g.title, current: g.currentAmount, target: g.targetAmount })),
        activeLoans: loans.map(l => ({ personName: l.personName, type: l.type, remaining: l.remainingAmount })),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
