const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
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
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: false,
  },
  serviceName: {
    type: String,
    required: true,
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
  price: Number,
  notes: String,
  // Payment fields
  paymentType: {
    type: String,
    enum: ['prepaid', 'postpaid'],
    default: 'postpaid',
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending',
  },
  stripeSessionId: String,
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Booking', bookingSchema);
