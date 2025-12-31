const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Service = require('./models/Service');

dotenv.config();

const services = [
  // Special Services
  { name: 'Men\'s Haircut', description: 'Professional haircut with styling', category: 'Special Services', price: 30, duration: 45, isActive: true },
  { name: 'Kids Haircut (Under 12)', description: 'Special haircut for children', category: 'Special Services', price: 20, duration: 30, isActive: true },
  { name: 'Hair Coloring', description: 'Full hair coloring service', category: 'Special Services', price: 60, duration: 90, isActive: true },
  
  // Body Massage
  { name: 'Swedish Massage', description: 'Relaxing full body massage', category: 'Body Massage', price: 70, duration: 60, isActive: true },
  { name: 'Deep Tissue Massage', description: 'Intense muscle therapy', category: 'Body Massage', price: 80, duration: 60, isActive: true },
  { name: 'Head Massage', description: 'Relaxing head and scalp massage', category: 'Body Massage', price: 25, duration: 20, isActive: true },
  { name: 'Foot Massage', description: 'Soothing foot massage', category: 'Body Massage', price: 30, duration: 30, isActive: true },
  
  // Beard Services
  { name: 'Beard Trim', description: 'Professional beard trimming and shaping', category: 'Beard Services', price: 15, duration: 20, isActive: true },
  { name: 'Beard Styling', description: 'Complete beard styling service', category: 'Beard Services', price: 20, duration: 25, isActive: true },
  { name: 'Full Shave', description: 'Traditional hot towel shave', category: 'Beard Services', price: 25, duration: 30, isActive: true },
  { name: 'Waxing', description: 'Professional waxing service', category: 'Beard Services', price: 15, duration: 20, isActive: true },
  
  // Hairdressing
  { name: 'Hair Straightening', description: 'Professional hair straightening', category: 'Hairdressing', price: 50, duration: 60, isActive: true },
  { name: 'Highlightsatment', description: 'Smoothing keratin treatment', category: 'Hairdressing', price: 100, duration: 120, isActive: true },
  { name: 'Hair Wash &', description: 'Hair highlights and lowlights', category: 'Hairdressing', price: 70, duration: 90, isActive: true },
  { name: 'Keratin Tre Blow Dry', description: 'Professional wash and styling', category: 'Hairdressing', price: 20, duration: 30, isActive: true },
];

const seedServices = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');

    // Clear existing services
    await Service.deleteMany({});
    console.log('🗑️  Cleared existing services');

    // Insert new services
    const insertedServices = await Service.insertMany(services);
    console.log(`✅ Successfully added ${insertedServices.length} services!`);
    
    console.log('\n📋 Services added:');
    insertedServices.forEach(service => {
      console.log(`   - ${service.name} (€${service.price}) - ${service.duration} min`);
    });

    mongoose.connection.close();
    console.log('\n✅ Seeding completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding services:', error);
    mongoose.connection.close();
    process.exit(1);
  }
};

seedServices();
