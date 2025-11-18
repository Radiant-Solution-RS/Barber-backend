const mongoose = require('mongoose');

const salonSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: String,
  address: String,
  city: String,
  phone: String,
  email: String,
  image: String,
  rating: {
    type: Number,
    default: 0,
  },
  services: [String],
  openingHours: {
    type: Map,
    of: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Salon', salonSchema);
