const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.log('⚠️  MONGODB_URI not set in environment variables');
      return;
    }
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('✅ MongoDB Connected successfully!');
  } catch (error) {
    console.log('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

connectDB();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/salons', require('./routes/salons'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/barbers', require('./routes/barbers'));
app.use('/api/services', require('./routes/services'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'DeLegends Barber API is running' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
