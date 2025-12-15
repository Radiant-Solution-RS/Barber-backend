const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Get all reviews (admin only)
router.get('/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('user booking')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get approved reviews (public)
router.get('/approved', async (req, res) => {
  try {
    const reviews = await Review.find({ status: 'approved' })
      .populate('user')
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user's reviews
router.get('/my-reviews', authMiddleware, async (req, res) => {
  try {
    const reviews = await Review.find({ user: req.user.id })
      .populate('booking')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create review
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;

    // Verify booking exists and belongs to user
    const booking = await Booking.findById(bookingId).populate('user');
    
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.user._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Check if booking is completed
    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Can only review completed appointments' });
    }

    // Check if review already exists for this booking
    const existingReview = await Review.findOne({ booking: bookingId });
    if (existingReview) {
      return res.status(400).json({ message: 'Review already submitted for this booking' });
    }

    // Create review
    const review = new Review({
      booking: bookingId,
      user: req.user.id,
      customerName: booking.user.name || booking.user.email,
      serviceName: booking.serviceName,
      rating,
      comment,
      status: 'pending',
    });

    await review.save();
    await review.populate('user booking');
    
    // Mark booking as reviewed
    booking.hasReview = true;
    await booking.save();
    
    res.status(201).json(review);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update review status (admin only)
router.patch('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: Date.now() },
      { new: true }
    ).populate('user booking');

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json(review);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete review (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    await review.deleteOne();
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
