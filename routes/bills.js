const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Bill = require('../models/Bill');
const Wallet = require('../models/Wallet');
const Expense = require('../models/Expense');
const auth = require('../middleware/auth');
const { parseError } = require('../utils/parseError');

router.use(auth);

// Clamps day to last valid day of the target month to avoid overflow (e.g. Feb 31 → Feb 28)
function clampedDate(year, month, day) {
  const days = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, days));
}

function computeNextDueDate(dueDay) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const candidate = clampedDate(year, month, dueDay);
  if (now.getDate() <= candidate.getDate()) return candidate;
  const nm = month + 1;
  return clampedDate(year + (nm > 11 ? 1 : 0), nm % 12, dueDay);
}

function advanceOneMonth(date, dueDay) {
  const nm = date.getMonth() + 1;
  const year = date.getFullYear() + (nm > 11 ? 1 : 0);
  return clampedDate(year, nm % 12, dueDay);
}

router.get('/', async (req, res) => {
  try {
    const { isActive } = req.query;
    const filter = { user: req.user.id };
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    const bills = await Bill.find(filter).populate('category wallet').sort({ nextDueDate: 1 });
    const totalMonthly = bills.filter(b => b.isActive).reduce((s, b) => s + b.amount, 0);
    res.json({ bills, totalMonthly });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, amount, dueDay, category, wallet: walletId, note } = req.body;
    if (!title || !String(title).trim()) return res.status(400).json({ message: 'title is required' });
    if (!amount || isNaN(amount) || Number(amount) <= 0) return res.status(400).json({ message: 'amount must be a positive number' });
    const day = parseInt(dueDay);
    if (!dueDay || isNaN(day) || day < 1 || day > 31) return res.status(400).json({ message: 'dueDay must be between 1 and 31' });
    if (walletId && !mongoose.Types.ObjectId.isValid(walletId)) return res.status(400).json({ message: 'Invalid wallet ID' });
    if (category && !mongoose.Types.ObjectId.isValid(category)) return res.status(400).json({ message: 'Invalid category ID' });

    const bill = await Bill.create({
      user: req.user.id,
      title,
      amount: Number(amount),
      dueDay: day,
      category: category || null,
      wallet: walletId || null,
      note: note || '',
      nextDueDate: computeNextDueDate(day),
    });
    await bill.populate('category wallet');
    res.status(201).json(bill);
  } catch (err) {
    res.status(400).json({ message: parseError(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid bill ID' });
    const bill = await Bill.findOne({ _id: req.params.id, user: req.user.id }).populate('category wallet');
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    res.json(bill);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid bill ID' });
    const { title, amount, dueDay, category, wallet: walletId, note, isActive } = req.body;
    const updates = { title, amount, category: category || null, wallet: walletId || null, note, isActive };
    if (dueDay) {
      updates.dueDay = dueDay;
      updates.nextDueDate = computeNextDueDate(dueDay);
    }
    const bill = await Bill.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      updates,
      { new: true, runValidators: true }
    ).populate('category wallet');
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    res.json(bill);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid bill ID' });
    const bill = await Bill.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    res.json({ message: 'Bill deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/pay', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid bill ID' });
    const bill = await Bill.findOne({ _id: req.params.id, user: req.user.id }).populate('category');
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    if (bill.isPaid) return res.status(400).json({ message: 'Bill already paid for this cycle' });

    const now = new Date();
    bill.isPaid = true;
    bill.lastPaidDate = now;
    bill.nextDueDate = advanceOneMonth(bill.nextDueDate, bill.dueDay);

    if (bill.wallet) {
      const wallet = await Wallet.findOne({ _id: bill.wallet, user: req.user.id });
      if (wallet) {
        wallet.balance -= bill.amount;
        await wallet.save();
      }
    }

    if (bill.category) {
      await Expense.create({
        user: req.user.id,
        title: `${bill.title} (Bill)`,
        amount: bill.amount,
        type: 'expense',
        category: bill.category._id,
        date: now,
        note: 'Auto-created from bill payment',
        wallet: bill.wallet || null,
      });
    }

    await bill.save();
    await bill.populate('category wallet');
    res.json(bill);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/unpay', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid bill ID' });
    const bill = await Bill.findOne({ _id: req.params.id, user: req.user.id });
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    bill.isPaid = false;
    bill.nextDueDate = computeNextDueDate(bill.dueDay);
    await bill.save();
    res.json(bill);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
