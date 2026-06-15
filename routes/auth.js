const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (user) =>
  jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Username and password are required' });
    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const exists = await User.findOne({ username: username.toLowerCase().trim() });
    if (exists) return res.status(409).json({ message: 'Username already taken' });

    const user = await User.create({ username, password });
    res.status(201).json({ token: signToken(user), username: user.username });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Username already taken' });
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Username and password are required' });

    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user) return res.status(401).json({ message: 'Invalid username or password' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ message: 'Invalid username or password' });

    res.json({ token: signToken(user), username: user.username });
  } catch (err) {
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

router.post('/change-password', require('../middleware/auth'), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both fields required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const match = await user.comparePassword(currentPassword);
    if (!match) return res.status(401).json({ message: 'Current password is incorrect' });
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
