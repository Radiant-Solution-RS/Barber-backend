const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');

/**
 * GET /api/availability/check
 * 
 * Check barber availability for a specific date
 * Returns available time slots in 15-minute intervals
 */
router.get('/check', async (req, res) => {
  try {
    const { barber, date, location } = req.query;
    
    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }
    
    // Get all bookings for the specified date
    const bookingQuery = { 
      date: new Date(date),
      status: { $ne: 'cancelled' }
    };
    
    if (barber) {
      bookingQuery.barber = barber;
    }
    
    if (location) {
      bookingQuery['location.id'] = location;
    }
    
    const bookings = await Booking.find(bookingQuery).populate('barber service');
    
    // Generate time slots (15-minute intervals from 9:00 to 20:00)
    const allTimeSlots = [];
    for (let hour = 9; hour < 20; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        allTimeSlots.push(timeString);
      }
    }
    
    // Check Lithuania time (EET/EEST - UTC+2/+3)
    const lithuaniaTime = new Date().toLocaleString('en-US', { 
      timeZone: 'Europe/Vilnius' 
    });
    const currentLithuaniaDate = new Date(lithuaniaTime);
    const selectedDate = new Date(date);
    
    // If selected date is today, filter out past times
    const isPastTime = (timeSlot) => {
      if (selectedDate.toDateString() !== currentLithuaniaDate.toDateString()) {
        return false; // Not today, so not in the past
      }
      
      const [hours, minutes] = timeSlot.split(':').map(Number);
      const slotTime = new Date(selectedDate);
      slotTime.setHours(hours, minutes, 0, 0);
      
      return slotTime <= currentLithuaniaDate;
    };
    
    // Mark slots as unavailable if booked
    const availableSlots = allTimeSlots.map(timeSlot => {
      // Check if past
      if (isPastTime(timeSlot)) {
        return {
          time: timeSlot,
          available: false,
          reason: 'past'
        };
      }
      
      // Check if any booking overlaps with this slot
      const isBooked = bookings.some(booking => {
        const bookingTime = booking.time;
        const duration = booking.totalDuration || booking.service?.duration || 30;
        
        // Parse booking time
        const [bookingHours, bookingMinutes] = bookingTime.split(':').map(Number);
        const bookingStart = bookingHours * 60 + bookingMinutes;
        const bookingEnd = bookingStart + duration;
        
        // Parse slot time
        const [slotHours, slotMinutes] = timeSlot.split(':').map(Number);
        const slotTime = slotHours * 60 + slotMinutes;
        
        // Check if slot falls within booking duration
        return slotTime >= bookingStart && slotTime < bookingEnd;
      });
      
      return {
        time: timeSlot,
        available: !isBooked,
        reason: isBooked ? 'booked' : null
      };
    });
    
    res.json({
      date,
      barber,
      location,
      slots: availableSlots,
      totalSlots: availableSlots.length,
      availableCount: availableSlots.filter(s => s.available).length
    });
    
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ message: 'Failed to check availability', error: error.message });
  }
});

/**
 * POST /api/availability/validate
 * 
 * Validate if a specific time slot is still available before booking
 */
router.post('/validate', async (req, res) => {
  try {
    const { barber, date, time, duration, location } = req.body;
    
    if (!date || !time || !duration) {
      return res.status(400).json({ message: 'Date, time, and duration are required' });
    }
    
    // Parse requested time
    const [reqHours, reqMinutes] = time.split(':').map(Number);
    const requestedStart = reqHours * 60 + reqMinutes;
    const requestedEnd = requestedStart + duration;
    
    // Find overlapping bookings
    const bookingQuery = {
      date: new Date(date),
      status: { $ne: 'cancelled' }
    };
    
    if (barber) {
      bookingQuery.barber = barber;
    }
    
    if (location) {
      bookingQuery['location.id'] = location;
    }
    
    const existingBookings = await Booking.find(bookingQuery);
    
    // Check for conflicts
    const hasConflict = existingBookings.some(booking => {
      const [bookingHours, bookingMinutes] = booking.time.split(':').map(Number);
      const bookingStart = bookingHours * 60 + bookingMinutes;
      const bookingDuration = booking.totalDuration || booking.service?.duration || 30;
      const bookingEnd = bookingStart + bookingDuration;
      
      // Check if time ranges overlap
      return (requestedStart < bookingEnd && requestedEnd > bookingStart);
    });
    
    res.json({
      available: !hasConflict,
      message: hasConflict 
        ? 'This time slot is no longer available' 
        : 'Time slot is available'
    });
    
  } catch (error) {
    console.error('Error validating availability:', error);
    res.status(500).json({ message: 'Failed to validate availability', error: error.message });
  }
});

module.exports = router;
