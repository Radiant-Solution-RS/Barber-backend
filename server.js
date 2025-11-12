const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// MongoDB Connection (optional - will work with mock data if not connected)
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('localhost')) {
      console.log('⚠️  Local MongoDB not detected. Using mock data.');
      console.log('💡 To use a database, set MONGODB_URI in .env to MongoDB Atlas URL');
      return;
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected successfully!');
  } catch (error) {
    console.log('⚠️  MongoDB connection failed - using mock data:', error.message);
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
