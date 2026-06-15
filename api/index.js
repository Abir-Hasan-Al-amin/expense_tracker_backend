const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('../config/db');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/auth', require('../routes/auth'));
app.use('/api/expenses', require('../routes/expenses'));
app.use('/api/categories', require('../routes/categories'));
app.use('/api/budgets', require('../routes/budgets'));

app.get('/', async (req, res) => {
  await connectDB();
  res.json({
    name: 'Expense Tracker API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date(),
    endpoints: ['/api/auth', '/api/expenses', '/api/categories', '/api/budgets', '/api/health'],
  });
});

app.get('/api/health', async (req, res) => {
  await connectDB();
  res.json({ status: 'ok', timestamp: new Date() });
});

app.use(require('../middleware/errorHandler'));

module.exports = app;
