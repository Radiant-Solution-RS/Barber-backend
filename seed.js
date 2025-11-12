const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');
const Salon = require('./models/Salon');
const Booking = require('./models/Booking');
const Barber = require('./models/Barber');
const Service = require('./models/Service');

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');

    // Clear existing data
    await User.deleteMany({});
    await Salon.deleteMany({});
    await Booking.deleteMany({});
    await Barber.deleteMany({});
    await Service.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create Users
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const owner = await User.create({
      name: 'Admin User',
      email: 'admin@delegends.com',
      password: hashedPassword,
      role: 'owner',
      phone: '555-0001',
    });

    const customer = await User.create({
      name: 'John Customer',
      email: 'customer@test.com',
      password: hashedPassword,
      role: 'customer',
      phone: '555-0002',
    });

    console.log('👥 Created users');

    // Create Barbers
    const barbers = await Barber.create([
      {
        name: 'John Barber',
        email: 'john@delegends.com',
        phone: '555-1001',
        specialties: ['Haircut', 'Fade', 'Lineup'],
        isActive: true,
      },
      {
        name: 'Mike Stylist',
        email: 'mike@delegends.com',
        phone: '555-1002',
        specialties: ['Haircut', 'Beard Trim', 'Hair Styling'],
        isActive: true,
      },
      {
        name: 'Sarah Specialist',
        email: 'sarah@delegends.com',
        phone: '555-1003',
        specialties: ['Hot Towel Shave', 'Beard Trim', 'Facial'],
        isActive: true,
      },
      {
        name: 'Tom Expert',
        email: 'tom@delegends.com',
        phone: '555-1004',
        specialties: ['Haircut', 'Hair Coloring'],
        isActive: true,
      },
    ]);

    console.log('💈 Created barbers');

    // Create Services
    const services = await Service.create([
      {
        name: 'Haircut',
        description: 'Professional haircut with styling',
        price: 45,
        duration: 30,
        isActive: true,
      },
      {
        name: 'Beard Trim',
        description: 'Precision beard trimming and shaping',
        price: 30,
        duration: 20,
        isActive: true,
      },
      {
        name: 'Hot Towel Shave',
        description: 'Traditional hot towel shave experience',
        price: 50,
        duration: 45,
        isActive: true,
      },
      {
        name: 'Hair Styling',
        description: 'Professional hair styling',
        price: 35,
        duration: 25,
        isActive: true,
      },
      {
        name: 'Hair Coloring',
        description: 'Professional hair coloring service',
        price: 80,
        duration: 90,
        isActive: true,
      },
      {
        name: 'Fade',
        description: 'Expert fade haircut',
        price: 40,
        duration: 35,
        isActive: true,
      },
    ]);

    console.log('✂️  Created services');

    // Create Salons
    const salons = await Salon.create([
      {
        name: 'DeLegends Barber Shop - Downtown',
        description: 'Premium barbering services in the heart of downtown. Experienced barbers, modern style cuts, and traditional hot towel shaves.',
        address: '123 Main Street',
        city: 'New York',
        phone: '555-1234',
        email: 'downtown@delegends.com',
        image: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800',
        rating: 4.8,
        services: ['Haircut', 'Beard Trim', 'Hot Towel Shave', 'Hair Coloring', 'Facial'],
        openingHours: {
          Monday: '9:00 AM - 8:00 PM',
          Tuesday: '9:00 AM - 8:00 PM',
          Wednesday: '9:00 AM - 8:00 PM',
          Thursday: '9:00 AM - 8:00 PM',
          Friday: '9:00 AM - 9:00 PM',
          Saturday: '8:00 AM - 9:00 PM',
          Sunday: '10:00 AM - 6:00 PM',
        },
      },
      {
        name: 'DeLegends Barber Shop - Uptown',
        description: 'Luxury grooming experience with a classic touch. Walk-ins welcome, appointments preferred.',
        address: '456 Park Avenue',
        city: 'New York',
        phone: '555-5678',
        email: 'uptown@delegends.com',
        image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800',
        rating: 4.9,
        services: ['Haircut', 'Beard Trim', 'Hot Towel Shave', 'Hair Styling', 'Scalp Treatment'],
        openingHours: {
          Monday: '10:00 AM - 7:00 PM',
          Tuesday: '10:00 AM - 7:00 PM',
          Wednesday: '10:00 AM - 7:00 PM',
          Thursday: '10:00 AM - 7:00 PM',
          Friday: '10:00 AM - 8:00 PM',
          Saturday: '9:00 AM - 8:00 PM',
          Sunday: 'Closed',
        },
      },
      {
        name: 'DeLegends Barber Shop - Brooklyn',
        description: 'Modern barbershop with vintage vibes. Expert fades, crisp lineups, and premium grooming products.',
        address: '789 Brooklyn Ave',
        city: 'Brooklyn',
        phone: '555-9012',
        email: 'brooklyn@delegends.com',
        image: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800',
        rating: 4.7,
        services: ['Haircut', 'Fade', 'Lineup', 'Beard Trim', 'Kids Cut'],
        openingHours: {
          Monday: '9:00 AM - 8:00 PM',
          Tuesday: '9:00 AM - 8:00 PM',
          Wednesday: '9:00 AM - 8:00 PM',
          Thursday: '9:00 AM - 8:00 PM',
          Friday: '9:00 AM - 9:00 PM',
          Saturday: '8:00 AM - 9:00 PM',
          Sunday: '10:00 AM - 5:00 PM',
        },
      },
    ]);

    console.log('💈 Created salons');

    // Create Sample Bookings
    await Booking.create([
      {
        user: owner._id,
        salon: salons[0]._id,
        barber: barbers[0]._id,
        service: services[0]._id,
        serviceName: services[0].name,
        date: new Date('2025-11-15'),
        time: '10:00 AM',
        status: 'pending',
        price: services[0].price,
        notes: 'First appointment',
      },
      {
        user: customer._id,
        salon: salons[1]._id,
        barber: barbers[1]._id,
        service: services[1]._id,
        serviceName: services[1].name,
        date: new Date('2025-11-16'),
        time: '2:00 PM',
        status: 'confirmed',
        price: services[1].price,
        notes: 'Regular customer',
      },
      {
        user: owner._id,
        salon: salons[2]._id,
        barber: barbers[2]._id,
        service: services[2]._id,
        serviceName: services[2].name,
        date: new Date('2025-11-17'),
        time: '11:30 AM',
        status: 'pending',
        price: services[2].price,
        notes: '',
      },
    ]);

    console.log('📅 Created sample bookings');
    console.log('\n✨ Database seeded successfully!');
    console.log('\n📝 Test Credentials:');
    console.log('Owner: admin@delegends.com / admin123');
    console.log('Customer: customer@test.com / admin123\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
