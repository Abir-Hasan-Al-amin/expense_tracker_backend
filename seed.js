const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Category = require('./models/Category');

const defaultCategories = [
  { name: 'Food & Dining', icon: 'restaurant', color: '#E17055', type: 'expense' },
  { name: 'Transportation', icon: 'car', color: '#74B9FF', type: 'expense' },
  { name: 'Shopping', icon: 'cart', color: '#A29BFE', type: 'expense' },
  { name: 'Housing', icon: 'home', color: '#55EFC4', type: 'expense' },
  { name: 'Healthcare', icon: 'medical', color: '#FF6B6B', type: 'expense' },
  { name: 'Education', icon: 'school', color: '#FDCB6E', type: 'expense' },
  { name: 'Entertainment', icon: 'game-controller', color: '#F368E0', type: 'expense' },
  { name: 'Fitness', icon: 'fitness', color: '#00B894', type: 'expense' },
  { name: 'Travel', icon: 'airplane', color: '#5F27CD', type: 'expense' },
  { name: 'Utilities', icon: 'flash', color: '#EE5A24', type: 'expense' },
  { name: 'Coffee', icon: 'cafe', color: '#6D4C41', type: 'expense' },
  { name: 'Personal Care', icon: 'heart', color: '#EC407A', type: 'expense' },
  { name: 'Salary', icon: 'cash', color: '#00B894', type: 'income' },
  { name: 'Freelance', icon: 'laptop', color: '#6C5CE7', type: 'income' },
  { name: 'Investment', icon: 'trending-up', color: '#0652DD', type: 'income' },
  { name: 'Gift', icon: 'gift', color: '#F368E0', type: 'income' },
  { name: 'Business', icon: 'briefcase', color: '#FDCB6E', type: 'income' },
  { name: 'Other', icon: 'ellipsis-horizontal', color: '#B2BEC3', type: 'both' },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const count = await Category.countDocuments();
    if (count > 0) {
      console.log('Categories already seeded. Skipping.');
      process.exit(0);
    }

    await Category.insertMany(defaultCategories);
    console.log(`Seeded ${defaultCategories.length} categories successfully`);
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
