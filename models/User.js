const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['customer', 'receptionist', 'admin', 'owner'],
    default: 'customer',
  },
  phone: String,
  // Additional customer information
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other / Prefers not to disclose'],
    default: 'Other / Prefers not to disclose',
  },
  birthMonth: Number,
  birthDay: Number,
  birthYear: Number,
  marketingConsent: {
    type: Boolean,
    default: false,
  },
  prepaymentRequired: {
    type: Boolean,
    default: false,
  },
  note: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);
