const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://barber-three-psi.vercel.app',
  'https://treatwell-sage.vercel.app'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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

// Booking/Guest webhook handler for SetupIntent and PaymentIntent events
app.post('/api/bookings/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const Booking = require('./models/Booking');
    const GuestCustomer = require('./models/GuestCustomer');
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Booking webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      // Handle setup_intent.succeeded (card saved successfully)
      if (event.type === 'setup_intent.succeeded') {
        const setupIntent = event.data.object;
        console.log(`✅ SetupIntent succeeded: ${setupIntent.id}`);
        
        // Update any bookings with this SetupIntent
        const booking = await Booking.findOne({ stripeSetupIntentId: setupIntent.id });
        if (booking) {
          booking.cardSetupComplete = true;
          booking.stripePaymentMethodId = setupIntent.payment_method;
          booking.auditLog.push({
            action: 'card_setup_confirmed',
            performedBy: 'Stripe Webhook',
            performedAt: new Date(),
            details: 'Card setup confirmed via webhook',
          });
          await booking.save();
          console.log(`✅ Booking ${booking._id} card setup confirmed`);
        }
      }

      // Handle payment_intent.succeeded (charge successful)
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        console.log(`✅ PaymentIntent succeeded: ${paymentIntent.id}`);
        
        const bookingId = paymentIntent.metadata.bookingId;
        if (bookingId) {
          const booking = await Booking.findById(bookingId);
          if (booking) {
            const reason = paymentIntent.metadata.reason;
            
            if (reason === 'late_cancellation') {
              booking.paymentStatus = 'charged_late_cancel';
            } else if (reason === 'no_show') {
              booking.paymentStatus = 'charged_no_show';
            } else {
              booking.paymentStatus = 'paid';
            }
            
            booking.isPaid = true;
            booking.stripePaymentIntentId = paymentIntent.id;
            booking.auditLog.push({
              action: 'payment_confirmed',
              performedBy: 'Stripe Webhook',
              performedAt: new Date(),
              details: `Payment confirmed: $${(paymentIntent.amount / 100).toFixed(2)} - Reason: ${reason || 'booking_payment'}`,
            });
            await booking.save();
            console.log(`✅ Booking ${booking._id} payment confirmed`);
          }
        }
      }

      // Handle payment_intent.payment_failed (charge failed)
      if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object;
        console.log(`❌ PaymentIntent failed: ${paymentIntent.id}`);
        
        const bookingId = paymentIntent.metadata.bookingId;
        if (bookingId) {
          const booking = await Booking.findById(bookingId);
          if (booking) {
            booking.paymentStatus = 'failed';
            booking.auditLog.push({
              action: 'payment_failed',
              performedBy: 'Stripe Webhook',
              performedAt: new Date(),
              details: `Payment failed: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`,
            });
            await booking.save();
            console.log(`❌ Booking ${booking._id} payment failed`);
          }
        }
      }

    } catch (error) {
      console.error('Error processing booking webhook:', error);
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
app.use('/api/guest-bookings', require('./routes/guestBookings'));
app.use('/api/admin/bookings', require('./routes/adminBookings'));
app.use('/api/barbers', require('./routes/barbers'));
app.use('/api/services', require('./routes/services'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/reviews', require('./routes/reviews'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'DeLegends Barber API is running' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
