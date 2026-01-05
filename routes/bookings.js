const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Booking = require('../models/Booking');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Get all bookings (admin only)
router.get('/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('user salon barber service');
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user's bookings
router.get('/', authMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id })
      .populate('salon barber service');
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create booking
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { service, serviceName, barber, date, time, price, notes, location, paymentType } = req.body;
    
    console.log('Received booking data:', { service, serviceName, barber, date, time, price, notes, location, paymentType });

    const booking = new Booking({
      user: req.user.id,
      service,
      serviceName,
      barber,
      date,
      time,
      price,
      notes,
      location,
      paymentType: paymentType || 'postpaid',
      paymentStatus: paymentType === 'prepaid' ? 'pending' : 'pending',
      isPaid: false,
    });

    await booking.save();
    console.log('Booking saved:', booking);
    await booking.populate('user barber service');
    res.status(201).json(booking);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create Stripe Checkout Session for Booking
router.post('/create-payment-session', authMiddleware, async (req, res) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findById(bookingId).populate('user barber service');
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if booking belongs to user
    if (booking.user._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${booking.serviceName} - Appointment`,
            description: `Barber: ${booking.barber?.name || 'TBD'} | Date: ${new Date(booking.date).toLocaleDateString()} | Time: ${booking.time}`,
          },
          unit_amount: Math.round(booking.price * 100), // Convert to cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/bookings?payment=success&booking_id=${bookingId}`,
      cancel_url: `${process.env.FRONTEND_URL}/bookings?payment=cancelled`,
      customer_email: booking.user.email,
      metadata: {
        bookingId: booking._id.toString(),
        type: 'booking',
      }
    });

    // Update booking with session ID
    booking.stripeSessionId = session.id;
    await booking.save();

    res.json({ 
      sessionId: session.id, 
      url: session.url,
    });

  } catch (error) {
    console.error('Checkout session error:', error);
    res.status(500).json({ message: 'Failed to create payment session', error: error.message });
  }
});

// Update booking payment status (for admin or after payment)
router.patch('/:id/payment', authMiddleware, async (req, res) => {
  try {
    const { paymentStatus, isPaid } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check authorization
    const isAdmin = req.user.role === 'admin' || req.user.role === 'owner';
    const isOwner = booking.user.toString() === req.user.id;
    
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (paymentStatus) booking.paymentStatus = paymentStatus;
    if (typeof isPaid !== 'undefined') booking.isPaid = isPaid;
    
    await booking.save();
    await booking.populate('user barber service');

    res.json(booking);
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update booking status (admin only)
router.patch('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('user salon barber service');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update booking details (admin/receptionist only)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin, owner, or receptionist
    const isStaff = req.user.role === 'admin' || req.user.role === 'owner' || req.user.role === 'receptionist';
    if (!isStaff) {
      return res.status(403).json({ message: 'Access denied. Staff only.' });
    }

    const { date, time, barber, service, notes } = req.body;
    
    const updateData = {};
    if (date) updateData.date = date;
    if (time) updateData.time = time;
    if (barber) updateData.barber = barber;
    if (service) updateData.service = service;
    if (notes !== undefined) updateData.notes = notes;
    
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('user salon barber service');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete booking
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.user.toString() !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await booking.deleteOne();
    res.json({ message: 'Booking deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add comment to booking (admin only)
router.post('/:id/comments', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    booking.comments.push({
      text: text.trim(),
      createdBy: req.user.name || 'Admin',
      createdAt: new Date(),
    });

    await booking.save();
    await booking.populate('user salon barber service');

    res.json(booking);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get dashboard stats (admin only)
router.get('/stats/dashboard', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const totalBookings = await Booking.countDocuments();
    const pendingBookings = await Booking.countDocuments({ status: 'pending' });
    const confirmedBookings = await Booking.countDocuments({ status: 'confirmed' });
    const completedBookings = await Booking.countDocuments({ status: 'completed' });

    res.json({
      totalBookings,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      totalStaff: 12,
      totalRevenue: 15420,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
