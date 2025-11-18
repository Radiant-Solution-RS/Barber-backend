const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Booking = require('../models/Booking');
const { authMiddleware } = require('../middleware/auth');

// Get all customers with booking stats
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Get all users with role 'customer'
    const customers = await User.find({ role: 'customer' })
      .select('-password')
      .sort({ createdAt: -1 });

    // Get booking stats for each customer
    const customersWithStats = await Promise.all(
      customers.map(async (customer) => {
        const bookings = await Booking.find({ user: customer._id });
        const lastBooking = await Booking.findOne({ user: customer._id })
          .sort({ createdAt: -1 })
          .select('createdAt');

        return {
          _id: customer._id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone || '',
          totalBookings: bookings.length,
          lastVisit: lastBooking ? lastBooking.createdAt : customer.createdAt,
          createdAt: customer.createdAt,
        };
      })
    );

    res.json(customersWithStats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single customer details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const customer = await User.findById(req.params.id).select('-password');
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const bookings = await Booking.find({ user: req.params.id })
      .populate('service', 'name')
      .populate('barber', 'name')
      .populate('salon', 'name')
      .sort({ createdAt: -1 });

    res.json({
      customer,
      bookings,
      totalBookings: bookings.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update customer
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    
    const customer = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, phone },
      { new: true }
    ).select('-password');

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete customer
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const customer = await User.findByIdAndDelete(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Optionally delete all bookings for this customer
    await Booking.deleteMany({ user: req.params.id });

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
