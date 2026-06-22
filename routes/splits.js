const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const SplitExpense = require('../models/SplitExpense');
const auth = require('../middleware/auth');
const { parseError } = require('../utils/parseError');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const splits = await SplitExpense.find({ user: req.user.id })
      .populate('wallet category')
      .sort({ date: -1 });
    res.json(splits);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, totalAmount, wallet: walletId, category, date, participants, note } = req.body;
    if (!title || !String(title).trim()) return res.status(400).json({ message: 'title is required' });
    if (!totalAmount || isNaN(totalAmount) || Number(totalAmount) <= 0)
      return res.status(400).json({ message: 'totalAmount must be a positive number' });
    if (!participants || !Array.isArray(participants) || participants.length === 0)
      return res.status(400).json({ message: 'At least one participant is required' });
    if (walletId && !mongoose.Types.ObjectId.isValid(walletId))
      return res.status(400).json({ message: 'Invalid wallet ID' });
    if (category && !mongoose.Types.ObjectId.isValid(category))
      return res.status(400).json({ message: 'Invalid category ID' });

    const split = await SplitExpense.create({
      user: req.user.id,
      title,
      totalAmount: Number(totalAmount),
      wallet: walletId || null,
      category: category || null,
      date: date || new Date(),
      participants,
      note: note || '',
    });
    await split.populate('wallet category');
    res.status(201).json(split);
  } catch (err) {
    res.status(400).json({ message: parseError(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid split ID' });
    const split = await SplitExpense.findOne({ _id: req.params.id, user: req.user.id }).populate('wallet category');
    if (!split) return res.status(404).json({ message: 'Split expense not found' });
    res.json(split);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid split ID' });
    const { title, totalAmount, wallet: walletId, category, date, participants, note } = req.body;
    const split = await SplitExpense.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { title, totalAmount, wallet: walletId || null, category: category || null, date, participants, note },
      { new: true, runValidators: true }
    ).populate('wallet category');
    if (!split) return res.status(404).json({ message: 'Split expense not found' });
    res.json(split);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid split ID' });
    const split = await SplitExpense.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!split) return res.status(404).json({ message: 'Split expense not found' });
    res.json({ message: 'Split expense deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/settle/:participantId', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid split ID' });
    const split = await SplitExpense.findOne({ _id: req.params.id, user: req.user.id });
    if (!split) return res.status(404).json({ message: 'Split expense not found' });

    const participant = split.participants.id(req.params.participantId);
    if (!participant) return res.status(404).json({ message: 'Participant not found' });
    if (participant.isPaid) return res.status(400).json({ message: 'Participant already settled' });

    participant.isPaid = true;
    participant.paidAt = new Date();
    await split.save();
    await split.populate('wallet category');
    res.json(split);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
