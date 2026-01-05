const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Booking = require('../models/Booking');
const { authMiddleware } = require('../middleware/auth');

// Get all customers who have booked appointments
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Get all users with role 'customer'
    const customers = await User.find({ role: 'customer' })
      .select('-password')
      .sort({ createdAt: -1 });

    // Get booking stats for each customer
    const customersWithStats = await Promise.all(
      customers.map(async (customer) => {
        // Get all bookings for this customer
        const bookings = await Booking.find({ user: customer._id })
          .populate('service barber')
          .sort({ createdAt: -1 });
        
        // Get the most recent booking
        const lastBooking = bookings.length > 0 ? bookings[0] : null;

        // Get unique services booked
        const servicesBooked = bookings.map(b => ({
          name: b.serviceName || b.service?.name,
          price: b.price,
          date: b.date,
          time: b.time,
          status: b.status,
          barber: b.barber?.name
        }));

        return {
          _id: customer._id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone || '',
          totalBookings: bookings.length,
          lastVisit: lastBooking ? lastBooking.createdAt : customer.createdAt,
          createdAt: customer.createdAt,
          servicesBooked: servicesBooked, // All booked services
        };
      })
    );

    // Filter out customers with no bookings if needed
    const customersWithBookings = customersWithStats.filter(c => c.totalBookings > 0);

    res.json(customersWithBookings);
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

    // Get regular bookings (with user account)
    const regularBookings = await Booking.find({ user: req.params.id })
      .populate('service', 'name')
      .populate('barber', 'name')
      .populate('salon', 'name')
      .sort({ createdAt: -1 });

    // Also get guest bookings by matching email
    const guestBookings = await Booking.find({ 
      'customerInfo.email': customer.email,
      isGuestBooking: true 
    })
      .populate('service', 'name')
      .populate('barber', 'name')
      .populate('salon', 'name')
      .sort({ createdAt: -1 });

    // Combine both types of bookings
    const allBookings = [...regularBookings, ...guestBookings]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      customer,
      bookings: allBookings,
      totalBookings: allBookings.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get customer info by email (for guest bookings)
router.get('/by-email/:email', authMiddleware, async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();

    // Try to find registered user by email (case-insensitive)
    const customer = await User.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') },
      role: 'customer' 
    }).select('-password');

    // Get all bookings with this email (both registered and guest)
    const regularBookings = customer ? await Booking.find({ user: customer._id })
      .populate('service', 'name')
      .populate('barber', 'name')
      .populate('salon', 'name')
      .sort({ createdAt: -1 }) : [];

    // Get guest bookings by email (with or without isGuestBooking flag)
    const guestBookings = await Booking.find({ 
      'customerInfo.email': { $regex: new RegExp(`^${email}$`, 'i') },
      $or: [
        { isGuestBooking: true },
        { user: null }  // Bookings without user are guest bookings
      ]
    })
      .populate('service', 'name')
      .populate('barber', 'name')
      .populate('salon', 'name')
      .sort({ createdAt: -1 });

    // Combine all bookings
    const allBookings = [...regularBookings, ...guestBookings]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // If customer exists, return full info; otherwise return guest info from first booking
    const customerInfo = customer || (guestBookings.length > 0 ? {
      name: guestBookings[0].customerInfo.name,
      email: guestBookings[0].customerInfo.email,
      phone: guestBookings[0].customerInfo.phone,
      isGuest: true
    } : null);

    if (!customerInfo) {
      return res.status(404).json({ message: 'No customer found with this email' });
    }

    res.json({
      customer: customerInfo,
      bookings: allBookings,
      totalBookings: allBookings.length,
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
