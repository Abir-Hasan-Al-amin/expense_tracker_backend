const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Expense = require('../models/Expense');
const auth = require('../middleware/auth');

router.use(auth);

const DEFAULT_CATEGORIES = [
  { name: 'Food & Dining', icon: 'restaurant', color: '#FF6B6B', type: 'expense' },
  { name: 'Transport', icon: 'car', color: '#74B9FF', type: 'expense' },
  { name: 'Shopping', icon: 'cart', color: '#FDCB6E', type: 'expense' },
  { name: 'Housing', icon: 'home', color: '#A29BFE', type: 'expense' },
  { name: 'Healthcare', icon: 'medical', color: '#00B894', type: 'expense' },
  { name: 'Entertainment', icon: 'film', color: '#E17055', type: 'expense' },
  { name: 'Education', icon: 'school', color: '#5F27CD', type: 'expense' },
  { name: 'Clothing', icon: 'shirt', color: '#F368E0', type: 'expense' },
  { name: 'Utilities', icon: 'flash', color: '#01CBC6', type: 'expense' },
  { name: 'Personal Care', icon: 'heart', color: '#FFA07A', type: 'expense' },
  { name: 'Salary', icon: 'briefcase', color: '#00B894', type: 'income' },
  { name: 'Freelance', icon: 'laptop', color: '#6C5CE7', type: 'income' },
  { name: 'Investment', icon: 'trending-up', color: '#74B9FF', type: 'income' },
  { name: 'Gift', icon: 'gift', color: '#FDCB6E', type: 'income' },
  { name: 'Other Income', icon: 'cash', color: '#A29BFE', type: 'income' },
];

router.post('/seed', async (req, res) => {
  try {
    const existing = await Category.countDocuments({ user: req.user.id });
    if (existing === 0) {
      await Category.insertMany(DEFAULT_CATEGORIES.map((c) => ({ ...c, user: req.user.id })));
    }
    const categories = await Category.find({ user: req.user.id }).sort({ name: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ user: req.user.id }).sort({ name: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, icon, color, type } = req.body;
    const category = new Category({ name, icon, color, type, user: req.user.id });
    await category.save();
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid category ID' });
    const { name, icon, color, type } = req.body;
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { name, icon, color, type },
      { new: true, runValidators: true }
    );
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json(category);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/all', async (req, res) => {
  try {
    const categories = await Category.find({ user: req.user.id }, '_id');
    const ids = categories.map((c) => c._id);
    await Expense.updateMany({ user: req.user.id, category: { $in: ids } }, { $set: { category: null } });
    const result = await Category.deleteMany({ user: req.user.id });
    res.json({ deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: 'Invalid category ID' });
    const category = await Category.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!category) return res.status(404).json({ message: 'Category not found' });
    await Expense.updateMany({ user: req.user.id, category: req.params.id }, { $set: { category: null } });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
