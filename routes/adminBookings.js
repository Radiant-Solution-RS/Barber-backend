const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Booking = require('../models/Booking');
const GuestCustomer = require('../models/GuestCustomer');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

/**
 * ADMIN BOOKING MANAGEMENT ROUTES
 * 
 * Handles admin-specific booking operations:
 * - Mark bookings as no-show
 * - Trigger late cancellation charges
 * - View customer history
 * - Manual charge retries
 */

/**
 * POST /api/admin/bookings/:id/mark-no-show
 * 
 * Mark a booking as no-show and charge full amount
 */
router.post('/:id/mark-no-show', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    const booking = await Booking.findById(id).populate('guestCustomer');
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    if (booking.isNoShow) {
      return res.status(400).json({ message: 'Booking already marked as no-show' });
    }
    
    // Mark as no-show
    booking.isNoShow = true;
    booking.noShowMarkedAt = new Date();
    booking.noShowMarkedBy = req.user.email || req.user.name;
    booking.status = 'cancelled';
    
    // Try to charge the customer
    let chargeSuccess = false;
    let chargeError = null;
    
    if (booking.cardSetupComplete && booking.stripePaymentMethodId) {
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(booking.totalPrice * 100),
          currency: 'usd',
          customer: booking.stripeCustomerId,
          payment_method: booking.stripePaymentMethodId,
          off_session: true,
          confirm: true,
          description: `No-show charge - ${booking.services.map(s => s.serviceName).join(', ')}`,
          metadata: {
            bookingId: booking._id.toString(),
            reason: 'no_show',
            markedBy: req.user.email || req.user.name,
          },
        });
        
        booking.paymentStatus = 'charged_no_show';
        booking.isPaid = true;
        booking.stripePaymentIntentId = paymentIntent.id;
        chargeSuccess = true;
        
        booking.chargeAttempts.push({
          attemptedAt: new Date(),
          amount: booking.totalPrice,
          reason: 'no_show',
          success: true,
          stripePaymentIntentId: paymentIntent.id,
        });
        
        // Update guest customer no-show count
        if (booking.guestCustomer) {
          booking.guestCustomer.noShowCount += 1;
          booking.guestCustomer.noShowHistory.push({
            bookingId: booking._id,
            markedAt: new Date(),
            markedBy: req.user.email || req.user.name,
          });
          await booking.guestCustomer.save();
        }
        
      } catch (err) {
        console.error('Error charging no-show:', err);
        chargeError = err.message;
        chargeSuccess = false;
        
        booking.chargeAttempts.push({
          attemptedAt: new Date(),
          amount: booking.totalPrice,
          reason: 'no_show',
          success: false,
          errorMessage: err.message,
        });
      }
    }
    
    booking.auditLog.push({
      action: 'no_show_marked',
      performedBy: req.user.email || req.user.name,
      performedAt: new Date(),
      details: `Marked as no-show. ${chargeSuccess ? `Charged $${booking.totalPrice}` : `Charge failed: ${chargeError || 'Card not on file'}`}. ${notes || ''}`,
    });
    
    await booking.save();
    await booking.populate('barber services.serviceId guestCustomer');
    
    res.json({
      message: chargeSuccess 
        ? 'Booking marked as no-show and customer charged successfully' 
        : 'Booking marked as no-show but charge failed',
      charged: chargeSuccess,
      amount: chargeSuccess ? booking.totalPrice : 0,
      error: chargeError,
      booking,
    });
    
  } catch (error) {
    console.error('Error marking no-show:', error);
    res.status(500).json({ message: 'Failed to mark no-show', error: error.message });
  }
});

/**
 * POST /api/admin/bookings/:id/retry-charge
 * 
 * Manually retry charging a customer (for failed charges)
 */
router.post('/:id/retry-charge', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body; // 'late_cancellation' or 'no_show'
    
    const booking = await Booking.findById(id).populate('guestCustomer');
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    if (!booking.cardSetupComplete || !booking.stripePaymentMethodId) {
      return res.status(400).json({ message: 'No card on file for this booking' });
    }
    
    if (booking.isPaid) {
      return res.status(400).json({ message: 'Booking already paid' });
    }
    
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(booking.totalPrice * 100),
        currency: 'usd',
        customer: booking.stripeCustomerId,
        payment_method: booking.stripePaymentMethodId,
        off_session: true,
        confirm: true,
        description: `Manual charge retry - ${reason} - ${booking.services.map(s => s.serviceName).join(', ')}`,
        metadata: {
          bookingId: booking._id.toString(),
          reason: reason || 'manual_retry',
          retriedBy: req.user.email || req.user.name,
        },
      });
      
      booking.paymentStatus = reason === 'no_show' ? 'charged_no_show' : 'charged_late_cancel';
      booking.isPaid = true;
      booking.stripePaymentIntentId = paymentIntent.id;
      
      booking.chargeAttempts.push({
        attemptedAt: new Date(),
        amount: booking.totalPrice,
        reason: reason || 'manual_retry',
        success: true,
        stripePaymentIntentId: paymentIntent.id,
      });
      
      booking.auditLog.push({
        action: 'manual_charge_retry_success',
        performedBy: req.user.email || req.user.name,
        performedAt: new Date(),
        details: `Successfully charged $${booking.totalPrice} - Reason: ${reason}`,
      });
      
      await booking.save();
      
      res.json({
        message: 'Charge successful',
        charged: true,
        amount: booking.totalPrice,
        booking,
      });
      
    } catch (err) {
      console.error('Error retrying charge:', err);
      
      booking.chargeAttempts.push({
        attemptedAt: new Date(),
        amount: booking.totalPrice,
        reason: reason || 'manual_retry',
        success: false,
        errorMessage: err.message,
      });
      
      booking.auditLog.push({
        action: 'manual_charge_retry_failed',
        performedBy: req.user.email || req.user.name,
        performedAt: new Date(),
        details: `Charge failed: ${err.message}`,
      });
      
      await booking.save();
      
      return res.status(400).json({
        message: 'Charge failed',
        error: err.message,
        booking,
      });
    }
    
  } catch (error) {
    console.error('Error retrying charge:', error);
    res.status(500).json({ message: 'Failed to retry charge', error: error.message });
  }
});

/**
 * GET /api/admin/bookings/guest-customer/:email/:phone
 * 
 * Get full customer history by email and phone
 */
router.get('/guest-customer/:email/:phone', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { email, phone } = req.params;
    
    const guestCustomer = await GuestCustomer.findOne({
      email: email.toLowerCase(),
      phone: decodeURIComponent(phone),
    });
    
    if (!guestCustomer) {
      return res.json({
        customer: null,
        bookings: [],
        stats: {
          totalBookings: 0,
          noShowCount: 0,
          lateCancellationCount: 0,
          completedBookings: 0,
        },
      });
    }
    
    const bookings = await Booking.find({ guestCustomer: guestCustomer._id })
      .populate('barber services.serviceId')
      .sort({ createdAt: -1 });
    
    const stats = {
      totalBookings: bookings.length,
      noShowCount: guestCustomer.noShowCount,
      lateCancellationCount: guestCustomer.lateCancellationCount,
      completedBookings: bookings.filter(b => b.status === 'completed').length,
      cancelledBookings: bookings.filter(b => b.status === 'cancelled').length,
      totalSpent: bookings
        .filter(b => b.isPaid)
        .reduce((sum, b) => sum + b.totalPrice, 0),
    };
    
    res.json({
      customer: {
        _id: guestCustomer._id,
        name: guestCustomer.name,
        email: guestCustomer.email,
        phone: guestCustomer.phone,
        noShowCount: guestCustomer.noShowCount,
        lateCancellationCount: guestCustomer.lateCancellationCount,
        noShowHistory: guestCustomer.noShowHistory,
        stripeCustomerId: guestCustomer.stripeCustomerId,
        hasCardOnFile: !!guestCustomer.stripePaymentMethodId,
        notes: guestCustomer.notes,
        createdAt: guestCustomer.createdAt,
      },
      bookings,
      stats,
    });
    
  } catch (error) {
    console.error('Error fetching guest customer:', error);
    res.status(500).json({ message: 'Failed to fetch customer data', error: error.message });
  }
});

/**
 * GET /api/admin/bookings/all-with-guests
 * 
 * Get all bookings including guest bookings
 */
router.get('/all-with-guests', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('user salon barber service guestCustomer services.serviceId')
      .sort({ createdAt: -1 });
    
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching all bookings:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * PUT /api/admin/guest-customers/:id/notes
 * 
 * Update guest customer notes
 */
router.put('/guest-customers/:id/notes', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    const guestCustomer = await GuestCustomer.findByIdAndUpdate(
      id,
      { notes },
      { new: true }
    );
    
    if (!guestCustomer) {
      return res.status(404).json({ message: 'Guest customer not found' });
    }
    
    res.json({ message: 'Notes updated', customer: guestCustomer });
  } catch (error) {
    console.error('Error updating notes:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
