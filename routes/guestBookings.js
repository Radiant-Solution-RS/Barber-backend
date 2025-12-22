const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Booking = require('../models/Booking');
const GuestCustomer = require('../models/GuestCustomer');
const Service = require('../models/Service');

/**
 * GUEST BOOKING ROUTES
 * 
 * No authentication required - Treatwell-style booking flow
 * 
 * Flow:
 * 1. Customer selects services (cart)
 * 2. Provides customer info (name, email, phone)
 * 3. Accepts cancellation policy
 * 4. Card collected via Stripe SetupIntent (mandatory security deposit)
 * 5. Booking created
 */

/**
 * POST /api/guest-bookings/create-setup-intent
 * 
 * Step 1: Create Stripe SetupIntent for card collection
 * This is called BEFORE booking creation to collect card details
 */
router.post('/create-setup-intent', async (req, res) => {
  try {
    const { customerInfo } = req.body;
    
    if (!customerInfo || !customerInfo.name || !customerInfo.email || !customerInfo.phone) {
      return res.status(400).json({ message: 'Customer information is required' });
    }
    
    // Find or create guest customer
    let guestCustomer = await GuestCustomer.findOne({
      email: customerInfo.email.toLowerCase(),
      phone: customerInfo.phone,
    });
    
    let stripeCustomerId = guestCustomer?.stripeCustomerId;
    
    // Create or retrieve Stripe Customer
    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        email: customerInfo.email,
        name: customerInfo.name,
        phone: customerInfo.phone,
        metadata: {
          source: 'guest_booking',
        },
      });
      stripeCustomerId = stripeCustomer.id;
      
      // Create or update guest customer record
      if (guestCustomer) {
        guestCustomer.stripeCustomerId = stripeCustomerId;
        guestCustomer.name = customerInfo.name;
        await guestCustomer.save();
      } else {
        guestCustomer = new GuestCustomer({
          name: customerInfo.name,
          email: customerInfo.email,
          phone: customerInfo.phone,
          stripeCustomerId: stripeCustomerId,
        });
        await guestCustomer.save();
      }
    }
    
    // Create SetupIntent for card collection
    // This allows us to charge the card later (off-session) if needed
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      metadata: {
        customer_email: customerInfo.email,
        customer_phone: customerInfo.phone,
      },
    });
    
    res.json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      guestCustomerId: guestCustomer._id,
    });
    
  } catch (error) {
    console.error('Error creating setup intent:', error);
    res.status(500).json({ message: 'Failed to create setup intent', error: error.message });
  }
});

/**
 * POST /api/guest-bookings/create
 * 
 * Step 2: Create booking after card setup is complete
 */
router.post('/create', async (req, res) => {
  try {
    const {
      customerInfo,
      services,
      barber,
      date,
      time,
      location,
      notes,
      cancellationPolicyAccepted,
      setupIntentId,
    } = req.body;
    
    // Validate required fields
    if (!customerInfo || !customerInfo.name || !customerInfo.email || !customerInfo.phone) {
      return res.status(400).json({ message: 'Customer information is required' });
    }
    
    if (!services || services.length === 0) {
      return res.status(400).json({ message: 'At least one service must be selected' });
    }
    
    if (!date || !time) {
      return res.status(400).json({ message: 'Date and time are required' });
    }
    
    if (!cancellationPolicyAccepted) {
      return res.status(400).json({ message: 'You must accept the cancellation policy' });
    }
    
    if (!setupIntentId) {
      return res.status(400).json({ message: 'Card setup is required' });
    }
    
    // Verify SetupIntent is successful
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
    
    if (setupIntent.status !== 'succeeded') {
      return res.status(400).json({ message: 'Card setup not complete. Please try again.' });
    }
    
    // Find or create guest customer
    let guestCustomer = await GuestCustomer.findOne({
      email: customerInfo.email.toLowerCase(),
      phone: customerInfo.phone,
    });
    
    if (!guestCustomer) {
      return res.status(400).json({ message: 'Customer not found. Please restart the booking process.' });
    }
    
    // Update guest customer with payment method
    guestCustomer.stripePaymentMethodId = setupIntent.payment_method;
    
    // Check if customer has previous no-shows
    const hasNoShowHistory = guestCustomer.noShowCount > 0;
    
    // Validate and calculate services total
    let totalPrice = 0;
    let totalDuration = 0;
    const validatedServices = [];
    
    // Debug logging
    console.log('📦 Received services:', JSON.stringify(services, null, 2));
    
    for (const svc of services) {
      console.log(`🔍 Looking up service with ID: ${svc.serviceId} (type: ${typeof svc.serviceId})`);
      const serviceDoc = await Service.findById(svc.serviceId);
      if (!serviceDoc) {
        return res.status(404).json({ message: `Service ${svc.serviceId} not found` });
      }
      
      totalPrice += serviceDoc.price;
      totalDuration += serviceDoc.duration;
      
      validatedServices.push({
        serviceId: serviceDoc._id,
        serviceName: serviceDoc.name,
        price: serviceDoc.price,
        duration: serviceDoc.duration,
      });
    }
    
    // Create booking
    const booking = new Booking({
      // No user reference - this is a guest booking
      user: null,
      guestCustomer: guestCustomer._id,
      customerInfo: {
        name: customerInfo.name,
        email: customerInfo.email,
        phone: customerInfo.phone,
      },
      services: validatedServices,
      // Also set first service as main service for backward compatibility
      service: validatedServices[0].serviceId,
      serviceName: validatedServices[0].serviceName,
      totalPrice,
      totalDuration,
      price: totalPrice,
      barber,
      date,
      time,
      location,
      notes,
      cancellationPolicyAccepted: true,
      cancellationPolicyAcceptedAt: new Date(),
      // Stripe information
      stripeCustomerId: guestCustomer.stripeCustomerId,
      stripeSetupIntentId: setupIntentId,
      stripePaymentMethodId: setupIntent.payment_method,
      cardSetupComplete: true,
      // Payment type depends on no-show history
      paymentType: hasNoShowHistory ? 'prepaid' : 'card_on_file',
      paymentStatus: hasNoShowHistory ? 'pending' : 'pending',
      isPaid: false,
      status: 'pending',
      source: 'Website',
      auditLog: [{
        action: 'booking_created',
        performedBy: `Guest: ${customerInfo.email}`,
        performedAt: new Date(),
        details: `Guest booking created. ${hasNoShowHistory ? 'Customer has no-show history - payment required.' : 'Card on file.'}`,
      }],
    });
    
    await booking.save();
    await guestCustomer.save();
    
    // If customer has no-show history, charge immediately
    let paymentRequired = hasNoShowHistory;
    let paymentIntentId = null;
    
    if (paymentRequired) {
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(totalPrice * 100), // Convert to cents
          currency: 'usd',
          customer: guestCustomer.stripeCustomerId,
          payment_method: setupIntent.payment_method,
          off_session: true,
          confirm: true,
          description: `Booking payment (customer has no-show history) - ${validatedServices.map(s => s.serviceName).join(', ')}`,
          metadata: {
            bookingId: booking._id.toString(),
            reason: 'prepayment_required_no_show_history',
          },
        });
        
        paymentIntentId = paymentIntent.id;
        booking.stripePaymentIntentId = paymentIntentId;
        booking.paymentStatus = 'paid';
        booking.isPaid = true;
        booking.auditLog.push({
          action: 'payment_charged',
          performedBy: 'System',
          performedAt: new Date(),
          details: 'Payment charged upfront due to no-show history',
        });
        await booking.save();
      } catch (err) {
        console.error('Error charging customer with no-show history:', err);
        booking.auditLog.push({
          action: 'payment_failed',
          performedBy: 'System',
          performedAt: new Date(),
          details: `Payment charge failed: ${err.message}`,
        });
        await booking.save();
      }
    }
    
    await booking.populate('barber services.serviceId guestCustomer');
    
    res.status(201).json({
      booking,
      paymentRequired,
      paymentIntentId,
      message: paymentRequired 
        ? 'Booking created and payment charged (customer has no-show history)' 
        : 'Booking created successfully with card on file',
    });
    
  } catch (error) {
    console.error('Error creating guest booking:', error);
    res.status(500).json({ message: 'Failed to create booking', error: error.message });
  }
});

/**
 * GET /api/guest-bookings/by-email-phone
 * 
 * Retrieve bookings for a guest customer (no auth required)
 * Required for customers to view their bookings without account
 */
router.post('/by-email-phone', async (req, res) => {
  try {
    const { email, phone } = req.body;
    
    if (!email || !phone) {
      return res.status(400).json({ message: 'Email and phone are required' });
    }
    
    const guestCustomer = await GuestCustomer.findOne({
      email: email.toLowerCase(),
      phone,
    });
    
    if (!guestCustomer) {
      return res.json({ bookings: [], customer: null });
    }
    
    const bookings = await Booking.find({ guestCustomer: guestCustomer._id })
      .populate('barber services.serviceId')
      .sort({ createdAt: -1 });
    
    res.json({
      bookings,
      customer: {
        name: guestCustomer.name,
        email: guestCustomer.email,
        phone: guestCustomer.phone,
        noShowCount: guestCustomer.noShowCount,
      },
    });
    
  } catch (error) {
    console.error('Error fetching guest bookings:', error);
    res.status(500).json({ message: 'Failed to fetch bookings', error: error.message });
  }
});

/**
 * DELETE /api/guest-bookings/:id/cancel
 * 
 * Cancel a guest booking
 * Charges full amount if within 24 hours or no-show
 */
router.delete('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, phone, reason } = req.body;
    
    if (!email || !phone) {
      return res.status(400).json({ message: 'Email and phone are required to cancel' });
    }
    
    const booking = await Booking.findById(id).populate('guestCustomer');
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    // Verify ownership
    if (booking.customerInfo.email.toLowerCase() !== email.toLowerCase() || 
        booking.customerInfo.phone !== phone) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    if (booking.status === 'cancelled') {
      return res.status(400).json({ message: 'Booking already cancelled' });
    }
    
    // Check if within 24 hours
    const appointmentTime = new Date(booking.date);
    appointmentTime.setHours(
      parseInt(booking.time.split(':')[0]),
      parseInt(booking.time.split(':')[1] || 0)
    );
    
    const now = new Date();
    const hoursUntilAppointment = (appointmentTime - now) / (1000 * 60 * 60);
    
    const isLateCancellation = hoursUntilAppointment < 24;
    
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancellationReason = reason || 'Customer cancellation';
    
    // Charge if late cancellation
    if (isLateCancellation && booking.cardSetupComplete) {
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(booking.totalPrice * 100),
          currency: 'usd',
          customer: booking.stripeCustomerId,
          payment_method: booking.stripePaymentMethodId,
          off_session: true,
          confirm: true,
          description: `Late cancellation charge (<24h) - ${booking.services.map(s => s.serviceName).join(', ')}`,
          metadata: {
            bookingId: booking._id.toString(),
            reason: 'late_cancellation',
          },
        });
        
        booking.paymentStatus = 'charged_late_cancel';
        booking.isPaid = true;
        booking.stripePaymentIntentId = paymentIntent.id;
        booking.chargeAttempts.push({
          attemptedAt: new Date(),
          amount: booking.totalPrice,
          reason: 'late_cancellation',
          success: true,
          stripePaymentIntentId: paymentIntent.id,
        });
        booking.auditLog.push({
          action: 'late_cancellation_charged',
          performedBy: `Guest: ${email}`,
          performedAt: new Date(),
          details: `Cancelled within 24 hours. Full amount charged: $${booking.totalPrice}`,
        });
        
        // Update guest customer
        if (booking.guestCustomer) {
          booking.guestCustomer.lateCancellationCount += 1;
          await booking.guestCustomer.save();
        }
        
      } catch (err) {
        console.error('Error charging late cancellation:', err);
        booking.chargeAttempts.push({
          attemptedAt: new Date(),
          amount: booking.totalPrice,
          reason: 'late_cancellation',
          success: false,
          errorMessage: err.message,
        });
        booking.auditLog.push({
          action: 'late_cancellation_charge_failed',
          performedBy: `Guest: ${email}`,
          performedAt: new Date(),
          details: `Charge failed: ${err.message}`,
        });
      }
    } else {
      booking.auditLog.push({
        action: 'booking_cancelled',
        performedBy: `Guest: ${email}`,
        performedAt: new Date(),
        details: isLateCancellation 
          ? 'Cancelled within 24 hours but card setup incomplete' 
          : 'Free cancellation (>24 hours)',
      });
    }
    
    await booking.save();
    
    res.json({
      message: isLateCancellation 
        ? 'Booking cancelled. Full amount has been charged due to late cancellation.' 
        : 'Booking cancelled successfully',
      charged: isLateCancellation,
      amount: isLateCancellation ? booking.totalPrice : 0,
      booking,
    });
    
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ message: 'Failed to cancel booking', error: error.message });
  }
});

module.exports = router;
