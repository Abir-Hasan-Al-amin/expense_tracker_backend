const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/budgets', require('./routes/budgets'));

app.get('/', (req, res) => {
  res.json({
    name: 'Expense Tracker API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date(),
    endpoints: ['/api/auth', '/api/expenses', '/api/categories', '/api/budgets', '/api/health'],
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.use(require('./middleware/errorHandler'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${PORT}`));
