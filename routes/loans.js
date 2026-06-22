const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Loan = require('../models/Loan');
const Wallet = require('../models/Wallet');
const auth = require('../middleware/auth');
const { createNotification } = require('../utils/notify');
const { parseError } = require('../utils/parseError');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { type, status } = req.query;
    if (type && !['borrowed', 'lent'].includes(type))
      return res.status(400).json({ message: 'type must be "borrowed" or "lent"' });
    if (status && !['active', 'partially_paid', 'settled'].includes(status))
      return res.status(400).json({ message: 'status must be "active", "partially_paid", or "settled"' });
    const filter = { user: req.user.id };
    if (type) filter.type = type;
    if (status) filter.status = status;
    const loans = await Loan.find(filter).populate('wallet').sort({ createdAt: -1 });

    const totalBorrowed = loans
      .filter(l => l.type === 'borrowed' && l.status !== 'settled')
      .reduce((s, l) => s + l.remainingAmount, 0);
    const totalLent = loans
      .filter(l => l.type === 'lent' && l.status !== 'settled')
      .reduce((s, l) => s + l.remainingAmount, 0);

    res.json({ loans, totalBorrowed, totalLent });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { type, personName, personContact, amount, dueDate, note, wallet: walletId } = req.body;
    if (!type || !['borrowed', 'lent'].includes(type))
      return res.status(400).json({ message: 'type must be "borrowed" or "lent"' });
    if (!personName || !String(personName).trim())
      return res.status(400).json({ message: 'personName is required' });
    if (!amount || isNaN(amount) || Number(amount) <= 0)
      return res.status(400).json({ message: 'amount must be a positive number' });
    if (walletId && !mongoose.Types.ObjectId.isValid(walletId))
      return res.status(400).json({ message: 'Invalid wallet ID' });

    const loan = await Loan.create({
      user: req.user.id,
      type,
      personName,
      personContact: personContact || '',
      amount: Number(amount),
      remainingAmount: Number(amount),
      dueDate: dueDate || null,
      note: note || '',
      wallet: walletId || null,
    });

    if (walletId) {
      const wallet = await Wallet.findOne({ _id: walletId, user: req.user.id });
      if (wallet) {
        wallet.balance += type === 'borrowed' ? amount : -amount;
        await wallet.save();
      }
    }

    await loan.populate('wallet');
    res.status(201).json(loan);
  } catch (err) {
    res.status(400).json({ message: parseError(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid loan ID' });
    const loan = await Loan.findOne({ _id: req.params.id, user: req.user.id }).populate('wallet');
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    res.json(loan);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid loan ID' });
    const { personName, personContact, dueDate, note } = req.body;
    const loan = await Loan.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { personName, personContact, dueDate, note },
      { new: true, runValidators: true }
    ).populate('wallet');
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    res.json(loan);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid loan ID' });
    const loan = await Loan.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    res.json({ message: 'Loan deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/repay', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid loan ID' });
    const { amount, note, wallet: walletId } = req.body;
    if (!amount || isNaN(amount) || Number(amount) <= 0)
      return res.status(400).json({ message: 'amount must be a positive number' });
    if (walletId && !mongoose.Types.ObjectId.isValid(walletId))
      return res.status(400).json({ message: 'Invalid wallet ID' });

    const loan = await Loan.findOne({ _id: req.params.id, user: req.user.id });
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    if (loan.status === 'settled') return res.status(400).json({ message: 'Loan already settled' });
    if (amount > loan.remainingAmount)
      return res.status(400).json({ message: 'Repayment exceeds remaining amount' });

    loan.repayments.push({ amount: Number(amount), note: note || '', date: new Date(), wallet: walletId || null });
    loan.remainingAmount = parseFloat((loan.remainingAmount - Number(amount)).toFixed(2));
    loan.status = loan.remainingAmount <= 0 ? 'settled' : 'partially_paid';
    await loan.save();

    if (walletId) {
      const wallet = await Wallet.findOne({ _id: walletId, user: req.user.id });
      if (wallet) {
        wallet.balance += loan.type === 'borrowed' ? -amount : amount;
        await wallet.save();
      }
    }

    if (loan.status === 'settled') {
      await createNotification(
        req.user.id, 'loan_settled', 'Loan Settled',
        `Your ${loan.type === 'borrowed' ? 'debt' : 'loan'} of ${loan.amount} with ${loan.personName} has been fully settled.`,
        loan._id, 'Loan'
      );
    }

    await loan.populate('wallet');
    res.json(loan);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
