const mongoose = require('mongoose');

/**
 * GuestCustomer Model
 * 
 * Tracks guest customers who book WITHOUT creating an account.
 * Uniquely identified by email + phone combination.
 * Stores no-show history and Stripe customer information.
 */
const guestCustomerSchema = new mongoose.Schema({
  // Customer identification (email + phone = unique customer)
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
  },
  phone: {
    type: String,
    required: true,
  },
  
  // Stripe payment information
  stripeCustomerId: {
    type: String,
    // Stripe Customer ID for storing payment methods
  },
  stripePaymentMethodId: {
    type: String,
    // Default payment method (card) saved via SetupIntent
  },
  
  // No-show tracking
  noShowCount: {
    type: Number,
    default: 0,
  },
  noShowHistory: [{
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
    markedBy: {
      type: String,
      // Admin user who marked no-show
    },
  }],
  
  // Late cancellation tracking
  lateCancellationCount: {
    type: Number,
    default: 0,
  },
  
  // Marketing preferences (optional)
  marketingConsent: {
    type: Boolean,
    default: false,
  },
  
  // Additional notes (admin use)
  notes: String,
  
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for email + phone (unique customer identification)
guestCustomerSchema.index({ email: 1, phone: 1 }, { unique: true });

// Update timestamp on save
guestCustomerSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('GuestCustomer', guestCustomerSchema);
