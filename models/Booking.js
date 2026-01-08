const mongoose = require('mongoose');

/**
 * Booking Model - Updated for Treatwell-style guest bookings
 * 
 * Key changes:
 * - User field is now OPTIONAL (supports guest bookings)
 * - Guest customer reference added
 * - Multiple services support (cart)
 * - Cancellation policy acceptance tracking
 * - No-show tracking
 * - Stripe SetupIntent and PaymentIntent tracking
 * - Audit trail for cancellations and charges
 */
const bookingSchema = new mongoose.Schema({
  // User reference - OPTIONAL (null for guest bookings)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  
  // Guest customer info (for bookings without account)
  guestCustomer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GuestCustomer',
    required: false,
  },
  
  // Direct customer info (always stored for quick access)
  customerInfo: {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
  },
  salon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Salon',
    required: false,
  },
  barber: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Barber',
    required: false,
  },
  // Service cart (supports multiple services)
  services: [{
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
    },
    serviceName: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
  }],
  
  // Legacy single service support (for backward compatibility)
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: false,
  },
  serviceName: {
    type: String,
    required: false,
  },
  location: {
    id: {
      type: String,
      required: false,
    },
    name: {
      type: String,
      required: false,
    },
    address: String,
    mapUrl: String,
  },
  date: {
    type: Date,
    required: true,
  },
  time: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending',
  },
  // Total booking price and duration
  totalPrice: {
    type: Number,
    required: true,
  },
  totalDuration: {
    type: Number,
    // Total duration in minutes
  },
  
  // Legacy price field (backward compatibility)
  price: Number,
  notes: String,
  
  // Cancellation policy acceptance
  cancellationPolicyAccepted: {
    type: Boolean,
    default: false,
    required: true,
  },
  cancellationPolicyAcceptedAt: {
    type: Date,
  },
  
  // DISABLED: No-show tracking removed as per Treatwell model
  // isNoShow: {
  //   type: Boolean,
  //   default: false,
  // },
  // noShowMarkedAt: Date,
  // noShowMarkedBy: String,
  
  // Payment fields - Enhanced for Stripe
  paymentType: {
    type: String,
    enum: ['prepaid', 'postpaid', 'card_on_file'],
    default: 'card_on_file',
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'charged_late_cancel', 'charged_no_show'],
    default: 'pending',
  },
  
  // Stripe identifiers
  stripeCustomerId: String,
  stripeSetupIntentId: String,
  stripePaymentMethodId: String,
  stripeSessionId: String,
  stripePaymentIntentId: String,
  
  // Card setup status
  cardSetupComplete: {
    type: Boolean,
    default: false,
  },
  
  isPaid: {
    type: Boolean,
    default: false,
  },
  // Source field
  source: {
    type: String,
    enum: ['Website', 'Treatwell', 'Walk-in', 'Phone', 'Manual'],
    default: 'Website',
  },
  // Comments field
  comments: [{
    text: {
      type: String,
      required: true,
    },
    createdBy: {
      type: String,
      default: 'Admin',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
  // Review tracking
  hasReview: {
    type: Boolean,
    default: false,
  },
  
  // Cancellation tracking
  cancelledAt: Date,
  cancellationReason: String,
  
  // Charge tracking (for late cancel / no-show)
  chargeAttempts: [{
    attemptedAt: {
      type: Date,
      default: Date.now,
    },
    amount: Number,
    reason: {
      type: String,
      enum: ['late_cancellation', 'no_show', 'service_completed', 'manual_retry'],
    },
    success: Boolean,
    stripePaymentIntentId: String,
    errorMessage: String,
  }],
  
  // Audit trail
  auditLog: [{
    action: String,
    performedBy: String,
    performedAt: {
      type: Date,
      default: Date.now,
    },
    details: String,
  }],
  
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp on save
bookingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
