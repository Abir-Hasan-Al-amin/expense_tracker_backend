const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const auth = require('../middleware/auth');
const { createNotification } = require('../utils/notify');
const { parseError } = require('../utils/parseError');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const wallets = await Wallet.find({ user: req.user.id }).sort({ createdAt: -1 });
    const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
    res.json({ wallets, totalBalance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, type, balance, currency, color } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ message: 'name is required' });
    if (type && !['cash', 'bank', 'credit_card', 'savings', 'other'].includes(type))
      return res.status(400).json({ message: 'type must be cash, bank, credit_card, savings, or other' });
    const wallet = await Wallet.create({ user: req.user.id, name, type, balance, currency, color });
    res.status(201).json(wallet);
  } catch (err) {
    res.status(400).json({ message: parseError(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid wallet ID' });
    const wallet = await Wallet.findOne({ _id: req.params.id, user: req.user.id });
    if (!wallet) return res.status(404).json({ message: 'Wallet not found' });
    res.json(wallet);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid wallet ID' });
    const { name, type, balance, currency, color } = req.body;
    const wallet = await Wallet.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { name, type, balance, currency, color },
      { new: true, runValidators: true }
    );
    if (!wallet) return res.status(404).json({ message: 'Wallet not found' });
    res.json(wallet);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid wallet ID' });
    const wallet = await Wallet.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!wallet) return res.status(404).json({ message: 'Wallet not found' });
    res.json({ message: 'Wallet deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/transfer', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid source wallet ID' });
    const { toWalletId, amount, note } = req.body;
    if (!toWalletId) return res.status(400).json({ message: 'toWalletId is required' });
    if (!amount || isNaN(amount) || Number(amount) <= 0) return res.status(400).json({ message: 'amount must be a positive number' });
    if (!mongoose.Types.ObjectId.isValid(toWalletId))
      return res.status(400).json({ message: 'Invalid destination wallet ID' });
    if (req.params.id === toWalletId)
      return res.status(400).json({ message: 'Source and destination wallets must be different' });

    const [from, to] = await Promise.all([
      Wallet.findOne({ _id: req.params.id, user: req.user.id }),
      Wallet.findOne({ _id: toWalletId, user: req.user.id }),
    ]);
    if (!from) return res.status(404).json({ message: 'Source wallet not found' });
    if (!to) return res.status(404).json({ message: 'Destination wallet not found' });
    if (from.balance < Number(amount)) return res.status(400).json({ message: 'Insufficient balance in source wallet' });

    from.balance -= Number(amount);
    to.balance += Number(amount);
    await Promise.all([from.save(), to.save()]);

    await createNotification(
      req.user.id, 'transfer', 'Transfer Completed',
      `Transferred ${amount} ${from.currency} from "${from.name}" to "${to.name}"${note ? ': ' + note : ''}`,
      from._id, 'Wallet'
    );

    res.json({ message: 'Transfer successful', from, to });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
