require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('./models/Booking');

const deleteAllBookings = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Count bookings before deletion
    const countBefore = await Booking.countDocuments();
    console.log(`📊 Found ${countBefore} bookings in database`);

    if (countBefore === 0) {
      console.log('ℹ️  No bookings to delete');
      process.exit(0);
    }

    // Delete all bookings
    const result = await Booking.deleteMany({});
    console.log(`🗑️  Deleted ${result.deletedCount} bookings successfully`);

    // Verify deletion
    const countAfter = await Booking.countDocuments();
    console.log(`📊 Remaining bookings: ${countAfter}`);

    console.log('✅ All bookings deleted successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting bookings:', error);
    process.exit(1);
  }
};

deleteAllBookings();
