const mongoose = require('mongoose');

const barberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: String,
  specialties: [String],
  profession: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
  avatar: String,
  profileImage: String,
  isActive: {
    type: Boolean,
    default: true,
  },
  // Role/Rights for login access
  role: {
    type: String,
    enum: ['receptionist', 'admin', 'owner'],
    default: 'receptionist',
  },
  // Work schedule for each day of the week
  schedule: {
    monday: {
      isWorking: { type: Boolean, default: true },
      startTime: { type: String, default: '10:00' },
      endTime: { type: String, default: '20:00' },
    },
    tuesday: {
      isWorking: { type: Boolean, default: true },
      startTime: { type: String, default: '10:00' },
      endTime: { type: String, default: '20:00' },
    },
    wednesday: {
      isWorking: { type: Boolean, default: true },
      startTime: { type: String, default: '10:00' },
      endTime: { type: String, default: '20:00' },
    },
    thursday: {
      isWorking: { type: Boolean, default: true },
      startTime: { type: String, default: '10:00' },
      endTime: { type: String, default: '20:00' },
    },
    friday: {
      isWorking: { type: Boolean, default: true },
      startTime: { type: String, default: '10:00' },
      endTime: { type: String, default: '20:00' },
    },
    saturday: {
      isWorking: { type: Boolean, default: true },
      startTime: { type: String, default: '10:00' },
      endTime: { type: String, default: '20:00' },
    },
    sunday: {
      isWorking: { type: Boolean, default: true },
      startTime: { type: String, default: '10:00' },
      endTime: { type: String, default: '20:00' },
    },
  },
  weeklyHours: {
    type: Number,
    default: 70,
  },
  // Week-specific schedule overrides (for specific dates)
  scheduleOverrides: [{
    date: { type: String, required: true }, // Format: 'YYYY-MM-DD'
    isWorking: { type: Boolean, default: false },
    startTime: { type: String, default: '10:00' },
    endTime: { type: String, default: '20:00' },
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Barber', barberSchema);
