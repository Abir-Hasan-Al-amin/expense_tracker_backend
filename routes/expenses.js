const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Wallet = require('../models/Wallet');
const auth = require('../middleware/auth');

router.use(auth);

function getNextDate(date, frequency) {
  const d = new Date(date);
  if (frequency === 'daily') d.setDate(d.getDate() + 1);
  else if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else if (frequency === 'monthly') {
    const day = d.getDate();
    d.setMonth(d.getMonth() + 1);
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    if (d.getDate() !== day) d.setDate(Math.min(day, daysInMonth));
  }
  return d;
}

router.post('/process-recurring', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const due = await Expense.find({
      user: req.user.id,
      isRecurring: true,
      recurringNextDate: { $lte: today },
    });

    const created = [];
    for (const src of due) {
      try {
        const newExp = await Expense.create({
          user: src.user,
          title: src.title,
          amount: src.amount,
          type: src.type,
          category: src.category,
          date: src.recurringNextDate,
          note: src.note,
          isRecurring: false,
        });
        await newExp.populate('category');
        created.push(newExp);
      } catch {
        // skip this entry (e.g. validation error) but still advance the date
      }
      src.recurringNextDate = getNextDate(src.recurringNextDate, src.recurringFrequency);
      await src.save();
    }
    res.json({ created: created.length, expenses: created });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { type, category, startDate, endDate, page = 1, sort = 'date', order = 'desc' } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const filter = { user: req.user.id };

    if (type) {
      if (!['expense', 'income'].includes(type)) return res.status(400).json({ message: 'Invalid type. Must be expense or income.' });
      filter.type = type;
    }
    if (category) {
      if (!mongoose.Types.ObjectId.isValid(category)) return res.status(400).json({ message: 'Invalid category ID.' });
      filter.category = category;
    }
    if (req.query.wallet) {
      if (!mongoose.Types.ObjectId.isValid(req.query.wallet)) return res.status(400).json({ message: 'Invalid wallet ID.' });
      filter.wallet = req.query.wallet;
    }
    if (req.query.tags) {
      const tagList = Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags];
      filter.tags = { $in: tagList };
    }
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const validOrder = order === 'asc' ? 1 : -1;
    const sortObj = {};
    sortObj[sort === 'amount' ? 'amount' : 'date'] = validOrder;

    const expenses = await Expense.find(filter)
      .populate('category wallet')
      .sort(sortObj)
      .limit(limit)
      .skip((parseInt(page) - 1) * limit);

    const total = await Expense.countDocuments(filter);
    res.json({ expenses, total, page: parseInt(page), limit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const targetMonth = month ? parseInt(month) - 1 : now.getMonth();
    const targetYear = year ? parseInt(year) : now.getFullYear();

    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
    const uid = mongoose.Types.ObjectId.createFromHexString(req.user.id);

    const [incomeResult, expenseResult, categoryBreakdown] = await Promise.all([
      Expense.aggregate([
        { $match: { user: uid, type: 'income', date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Expense.aggregate([
        { $match: { user: uid, type: 'expense', date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Expense.aggregate([
        { $match: { user: uid, type: 'expense', date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
        { $unwind: '$category' },
        { $sort: { total: -1 } },
      ]),
    ]);

    const totalIncome = incomeResult[0]?.total || 0;
    const totalExpense = expenseResult[0]?.total || 0;

    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(targetYear, targetMonth - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const [inc, exp] = await Promise.all([
        Expense.aggregate([
          { $match: { user: uid, type: 'income', date: { $gte: d, $lte: end } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        Expense.aggregate([
          { $match: { user: uid, type: 'expense', date: { $gte: d, $lte: end } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
      ]);
      monthlyData.push({
        month: d.toLocaleString('default', { month: 'short' }),
        income: inc[0]?.total || 0,
        expense: exp[0]?.total || 0,
      });
    }

    res.json({ totalIncome, totalExpense, balance: totalIncome - totalExpense, categoryBreakdown, monthlyData });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/recurring', async (req, res) => {
  try {
    const expenses = await Expense.find({ user: req.user.id, isRecurring: true })
      .populate('category')
      .sort({ recurringNextDate: 1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const expenses = await Expense.find({ user: req.user.id })
      .populate('category')
      .sort({ date: -1 });
    res.json({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      count: expenses.length,
      transactions: expenses,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/bulk-import', async (req, res) => {
  try {
    const { mode, transactions } = req.body;
    if (!transactions || !Array.isArray(transactions))
      return res.status(400).json({ message: 'Invalid backup data' });
    if (transactions.length > 10000)
      return res.status(400).json({ message: 'Backup too large. Maximum 10,000 transactions per import.' });

    const Category = require('../models/Category');
    const toInsert = [];
    let skipped = 0;

    for (const t of transactions) {
      try {
        let categoryId = null;
        if (t.category) {
          const catData = typeof t.category === 'object' ? t.category : {};
          const catName = catData.name || String(t.category);
          let cat = await Category.findOne({ user: req.user.id, name: catName });
          if (!cat) {
            cat = await Category.create({
              user: req.user.id,
              name: catName,
              icon: catData.icon || 'ellipsis-horizontal',
              color: catData.color || '#6C5CE7',
              type: catData.type || 'both',
            });
          }
          categoryId = cat._id;
        }
        toInsert.push({
          user: req.user.id,
          title: t.title,
          amount: t.amount,
          type: t.type,
          category: categoryId,
          date: t.date ? new Date(t.date) : new Date(),
          note: t.note || '',
          isRecurring: t.isRecurring || false,
          recurringFrequency: t.recurringFrequency || null,
          recurringNextDate: t.recurringNextDate ? new Date(t.recurringNextDate) : null,
        });
      } catch {
        skipped++;
      }
    }

    if (mode === 'replace') await Expense.deleteMany({ user: req.user.id });
    if (toInsert.length > 0) await Expense.insertMany(toInsert, { ordered: false });

    res.json({ imported: toInsert.length, skipped });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid expense ID' });
    const expense = await Expense.findOne({ _id: req.params.id, user: req.user.id }).populate('category wallet');
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    res.json(expense);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, amount, type, category, date, note, isRecurring, recurringFrequency, wallet: walletId, tags } = req.body;
    const body = { user: req.user.id, title, amount, type, category, date, note, isRecurring, recurringFrequency, wallet: walletId || null, tags: tags || [] };
    if (body.isRecurring && body.recurringFrequency) {
      body.recurringNextDate = getNextDate(body.date || new Date(), body.recurringFrequency);
    }
    const expense = new Expense(body);
    await expense.save();

    if (walletId) {
      const wallet = await Wallet.findOne({ _id: walletId, user: req.user.id });
      if (wallet) {
        wallet.balance += type === 'income' ? amount : -amount;
        await wallet.save();
      }
    }

    await expense.populate('category wallet');
    res.status(201).json(expense);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid expense ID' });

    const old = await Expense.findOne({ _id: req.params.id, user: req.user.id });
    if (!old) return res.status(404).json({ message: 'Expense not found' });

    const { title, amount, type, category, date, note, isRecurring, recurringFrequency, wallet: walletId, tags } = req.body;
    const body = { title, amount, type, category, date, note, isRecurring, recurringFrequency, wallet: walletId || null, tags: tags || [] };
    if (body.isRecurring && body.recurringFrequency) {
      body.recurringNextDate = getNextDate(body.date || new Date(), body.recurringFrequency);
    } else if (!body.isRecurring) {
      body.recurringFrequency = null;
      body.recurringNextDate = null;
    }

    // Reverse old wallet balance effect
    if (old.wallet) {
      const oldWallet = await Wallet.findOne({ _id: old.wallet, user: req.user.id });
      if (oldWallet) {
        oldWallet.balance += old.type === 'income' ? -old.amount : old.amount;
        await oldWallet.save();
      }
    }

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      body,
      { new: true, runValidators: true }
    ).populate('category wallet');

    // Apply new wallet balance effect
    if (expense.wallet) {
      const newWallet = await Wallet.findOne({ _id: expense.wallet._id, user: req.user.id });
      if (newWallet) {
        newWallet.balance += expense.type === 'income' ? expense.amount : -expense.amount;
        await newWallet.save();
      }
    }

    res.json(expense);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/all', async (req, res) => {
  try {
    const result = await Expense.deleteMany({ user: req.user.id });
    res.json({ deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid expense ID' });
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!expense) return res.status(404).json({ message: 'Expense not found' });

    if (expense.wallet) {
      const wallet = await Wallet.findOne({ _id: expense.wallet, user: req.user.id });
      if (wallet) {
        wallet.balance += expense.type === 'income' ? -expense.amount : expense.amount;
        await wallet.save();
      }
    }

    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
