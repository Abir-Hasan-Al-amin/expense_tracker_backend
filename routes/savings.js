const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const SavingsGoal = require('../models/SavingsGoal');
const Wallet = require('../models/Wallet');
const auth = require('../middleware/auth');
const { createNotification } = require('../utils/notify');
const { parseError } = require('../utils/parseError');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    if (status && !['active', 'completed', 'cancelled'].includes(status))
      return res.status(400).json({ message: 'status must be "active", "completed", or "cancelled"' });
    const filter = { user: req.user.id };
    if (status) filter.status = status;
    const goals = await SavingsGoal.find(filter).sort({ createdAt: -1 });
    res.json(goals);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, targetAmount, deadline, icon } = req.body;
    if (!title || !String(title).trim())
      return res.status(400).json({ message: 'title is required' });
    if (!targetAmount || isNaN(targetAmount) || Number(targetAmount) <= 0)
      return res.status(400).json({ message: 'targetAmount must be a positive number' });

    const goal = await SavingsGoal.create({
      user: req.user.id,
      title,
      targetAmount: Number(targetAmount),
      deadline: deadline || null,
      icon: icon || '🎯',
    });
    res.status(201).json(goal);
  } catch (err) {
    res.status(400).json({ message: parseError(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid goal ID' });
    const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.user.id });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    res.json(goal);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid goal ID' });
    const { title, targetAmount, deadline, icon, status } = req.body;
    const goal = await SavingsGoal.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { title, targetAmount, deadline, icon, status },
      { new: true, runValidators: true }
    );
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    res.json(goal);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid goal ID' });
    const goal = await SavingsGoal.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    res.json({ message: 'Goal deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/contribute', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid goal ID' });
    const { amount, note, wallet: walletId } = req.body;
    if (!amount || isNaN(amount) || Number(amount) <= 0)
      return res.status(400).json({ message: 'amount must be a positive number' });
    if (walletId && !mongoose.Types.ObjectId.isValid(walletId))
      return res.status(400).json({ message: 'Invalid wallet ID' });

    const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.user.id });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    if (goal.status !== 'active') return res.status(400).json({ message: 'Goal is not active' });

    const prevPercent = Math.floor((goal.currentAmount / goal.targetAmount) * 100);
    goal.contributions.push({ amount: Number(amount), note: note || '', date: new Date(), wallet: walletId || null });
    goal.currentAmount = parseFloat((goal.currentAmount + Number(amount)).toFixed(2));
    const newPercent = Math.floor((goal.currentAmount / goal.targetAmount) * 100);

    if (goal.currentAmount >= goal.targetAmount) {
      goal.status = 'completed';
      await createNotification(
        req.user.id, 'goal_completed', 'Goal Reached!',
        `Congratulations! You have reached your savings goal: "${goal.title}" (${goal.targetAmount})`,
        goal._id, 'SavingsGoal'
      );
    } else {
      for (const milestone of [25, 50, 75]) {
        if (prevPercent < milestone && newPercent >= milestone) {
          await createNotification(
            req.user.id, 'goal_milestone', `${milestone}% Milestone Reached!`,
            `You are ${milestone}% of the way to your goal "${goal.title}"`,
            goal._id, 'SavingsGoal'
          );
          break;
        }
      }
    }

    await goal.save();

    if (walletId) {
      const wallet = await Wallet.findOne({ _id: walletId, user: req.user.id });
      if (wallet) {
        wallet.balance -= amount;
        await wallet.save();
      }
    }

    res.json(goal);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
