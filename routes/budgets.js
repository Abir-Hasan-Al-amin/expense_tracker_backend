const express = require('express');
const router = express.Router();
const Budget = require('../models/Budget');
const Expense = require('../models/Expense');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();

    const budgets = await Budget.find({ user: req.user.id, month, year }).populate('category');

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    const uid = mongoose.Types.ObjectId.createFromHexString(req.user.id);

    const spending = await Expense.aggregate([
      { $match: { user: uid, type: 'expense', date: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$category', spent: { $sum: '$amount' } } },
    ]);

    const spendMap = {};
    spending.forEach((s) => { spendMap[s._id.toString()] = s.spent; });

    const result = budgets
      .filter((b) => b.category != null)
      .map((b) => ({
        ...b.toObject(),
        spent: spendMap[b.category._id.toString()] || 0,
      }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { category, amount, month, year } = req.body;
    const budget = await Budget.findOneAndUpdate(
      { user: req.user.id, category, month, year },
      { amount },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await budget.populate('category');
    res.status(201).json(budget);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const budget = await Budget.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!budget) return res.status(404).json({ message: 'Budget not found' });
    res.json({ message: 'Budget deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
