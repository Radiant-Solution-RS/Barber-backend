const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Booking = require('../models/Booking');
const GuestCustomer = require('../models/GuestCustomer');
const { authMiddleware, adminMiddleware, adminOrReceptionistMiddleware } = require('../middleware/auth');

/**
 * ADMIN & RECEPTIONIST BOOKING MANAGEMENT ROUTES
 * 
 * Handles staff-specific booking operations:
 * - DISABLED: Mark bookings as no-show (removed as per Treatwell model)
 * - DISABLED: Trigger late cancellation charges (removed as per Treatwell model)
 * - View customer history
 * - Manual booking creation
 */

// Test endpoint to verify route is working
router.get('/test', authMiddleware, (req, res) => {
  console.log('✅ Test route hit!');
  res.json({ message: 'Admin bookings route is working!', user: req.user });
});

/**
 * POST /api/admin/bookings/:id/mark-no-show
 * DISABLED: No-show feature removed as per Treatwell model
 */
router.post('/:id/mark-no-show', authMiddleware, adminMiddleware, async (req, res) => {
  return res.status(403).json({ 
    message: 'No-show feature has been disabled as per business requirements.' 
  });
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
        details: `Successfully charged €${booking.totalPrice} - Reason: ${reason}`,
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
 * POST /api/admin/bookings/:id/charge-payment
 * 
 * Charge payment after service completion (for admin/receptionist)
 * This allows staff to charge the customer's card after the haircut is done
 */
router.post('/:id/charge-payment', authMiddleware, adminOrReceptionistMiddleware, async (req, res) => {
  console.log('\n========================================');
  console.log('👉 CHARGE PAYMENT ENDPOINT HIT');
  console.log('User:', req.user);
  console.log('Booking ID:', req.params.id);
  console.log('========================================\n');
  
  try {
    const { id } = req.params;
    console.log('💳 Charge payment request for booking:', id);
    
    const booking = await Booking.findById(id).populate('guestCustomer');
    
    if (!booking) {
      console.log('❌ Booking not found:', id);
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    console.log('📋 Booking found:', {
      isPaid: booking.isPaid,
      cardSetupComplete: booking.cardSetupComplete,
      stripePaymentMethodId: booking.stripePaymentMethodId,
      stripeCustomerId: booking.stripeCustomerId,
      price: booking.price,
      totalPrice: booking.totalPrice
    });
    
    // Check if already paid
    if (booking.isPaid) {
      return res.status(400).json({ message: 'Booking already paid' });
    }
    
    // Check if card is on file
    if (!booking.cardSetupComplete || !booking.stripePaymentMethodId) {
      return res.status(400).json({ 
        message: 'No card on file. Customer needs to provide payment method.' 
      });
    }
    
    // Determine the amount to charge
    const chargeAmount = booking.totalPrice || booking.price || 0;
    
    if (chargeAmount <= 0) {
      return res.status(400).json({ 
        message: 'Invalid booking amount. Cannot charge $0.' 
      });
    }
    
    // Get service description
    const serviceDescription = booking.serviceName || 
      (booking.services && booking.services.length > 0 ? booking.services.map(s => s.serviceName).join(', ') : 'Service');
    
    console.log('💰 Attempting to charge:', {
      amount: chargeAmount,
      amountInCents: Math.round(chargeAmount * 100),
      customerId: booking.stripeCustomerId,
      paymentMethodId: booking.stripePaymentMethodId,
      description: serviceDescription
    });
    
    // Charge the card
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(chargeAmount * 100), // Convert to cents
        currency: 'usd',
        customer: booking.stripeCustomerId,
        payment_method: booking.stripePaymentMethodId,
        off_session: true,
        confirm: true,
        description: `Payment for service - ${serviceDescription}`,
        metadata: {
          bookingId: booking._id.toString(),
          chargedBy: req.user.email || req.user.name,
          reason: 'service_completed',
        },
      });
      
      console.log('✅ Payment successful:', paymentIntent.id);
      
      // Update booking - mark as paid AND completed
      booking.paymentStatus = 'paid';
      booking.isPaid = true;
      booking.status = 'completed'; // Mark booking as completed when payment is charged
      booking.stripePaymentIntentId = paymentIntent.id;
      
      booking.chargeAttempts.push({
        attemptedAt: new Date(),
        amount: chargeAmount,
        reason: 'service_completed',
        success: true,
        stripePaymentIntentId: paymentIntent.id,
      });
      
      booking.auditLog.push({
        action: 'payment_charged_after_service',
        performedBy: req.user.email || req.user.name,
        performedAt: new Date(),
        details: `Payment charged after service completion: €${chargeAmount}`,
      });
      
      await booking.save();
      
      res.json({
        success: true,
        message: 'Payment charged successfully!',
        amount: chargeAmount,
        booking,
      });
      
    } catch (stripeError) {
      console.error('❌ Stripe charge error:', stripeError);
      console.error('Error details:', {
        type: stripeError.type,
        code: stripeError.code,
        message: stripeError.message
      });
      
      // Log failed attempt
      booking.chargeAttempts.push({
        attemptedAt: new Date(),
        amount: chargeAmount,
        reason: 'service_completed',
        success: false,
        errorMessage: stripeError.message,
      });
      
      booking.auditLog.push({
        action: 'payment_charge_failed',
        performedBy: req.user.email || req.user.name,
        performedAt: new Date(),
        details: `Payment charge failed: ${stripeError.message}`,
      });
      
      await booking.save();
      
      return res.status(400).json({
        success: false,
        message: 'Payment charge failed',
        error: stripeError.message,
      });
    }
    
  } catch (error) {
    console.error('❌ Error charging payment:', error);
    console.error('Full error:', error.stack);
    res.status(500).json({ 
      success: false,
      message: 'Failed to charge payment', 
      error: error.message 
    });
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
