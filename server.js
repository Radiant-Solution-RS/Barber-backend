const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const app = express();

// Middleware
app.use(cors());

// Webhook route needs raw body - MUST be before express.json()
app.post('/api/orders/webhook', 
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const Order = require('./models/Order');
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      try {
        const order = await Order.findById(session.metadata.orderId);
        if (order) {
          order.paymentStatus = 'paid';
          order.stripePaymentIntentId = session.payment_intent;
          await order.save();
          console.log(`✅ Order ${order.orderNumber} marked as paid`);
        }
      } catch (error) {
        console.error('Error updating order:', error);
      }
    }

    res.json({ received: true });
  }
);

// Regular JSON middleware for other routes
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

// Test Cloudinary configuration on startup
try {
  const { cloudinary } = require('./config/cloudinary');
  console.log('✅ Cloudinary configuration loaded');
  console.log('   Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? '✓ Set' : '✗ Not Set');
  console.log('   API Key:', process.env.CLOUDINARY_API_KEY ? '✓ Set' : '✗ Not Set');
  console.log('   API Secret:', process.env.CLOUDINARY_API_SECRET ? '✓ Set' : '✗ Not Set');
} catch (err) {
  console.error('❌ Error loading Cloudinary config:', err.message);
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/salons', require('./routes/salons'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/barbers', require('./routes/barbers'));
app.use('/api/services', require('./routes/services'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'DeLegends Barber API is running' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
