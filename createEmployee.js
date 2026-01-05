/**
 * Employee Account Creation Script
 * 
 * Usage:
 * node createEmployee.js
 * 
 * This script creates employee accounts (Receptionist, Admin, Owner)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

/**
 * Create employee accounts
 */
async function createEmployees() {
  try {
    console.log('\n🚀 Starting employee account creation...\n');

    // Define employees to create
    const employees = [
      {
        name: 'Admin User',
        email: 'admin@salon.com',
        password: 'admin123',
        phone: '+92-300-1111111',
        role: 'admin'
      },
      {
        name: 'Ali Receptionist',
        email: 'receptionist@salon.com',
        password: 'recept123',
        phone: '+92-300-2222222',
        role: 'receptionist'
      },
      {
        name: 'Owner Sahab',
        email: 'owner@salon.com',
        password: 'owner123',
        phone: '+92-300-3333333',
        role: 'owner'
      }
    ];

    for (const emp of employees) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: emp.email });
      
      if (existingUser) {
        console.log(`⚠️  ${emp.role.toUpperCase()} already exists: ${emp.email}`);
        console.log(`   You can login with existing credentials\n`);
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(emp.password, 10);

      // Create user
      const user = new User({
        name: emp.name,
        email: emp.email,
        password: hashedPassword,
        phone: emp.phone,
        role: emp.role,
      });

      await user.save();

      console.log(`✅ ${emp.role.toUpperCase()} created successfully!`);
      console.log(`   Name: ${emp.name}`);
      console.log(`   Email: ${emp.email}`);
      console.log(`   Password: ${emp.password}`);
      console.log(`   Role: ${emp.role}\n`);
    }

    console.log('🎉 All employees created successfully!\n');
    console.log('📋 Login Credentials Summary:');
    console.log('================================');
    employees.forEach(emp => {
      console.log(`\n${emp.role.toUpperCase()}:`);
      console.log(`  Email: ${emp.email}`);
      console.log(`  Password: ${emp.password}`);
    });
    console.log('\n================================\n');
    
  } catch (error) {
    console.error('❌ Error creating employees:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  }
}

// Run the script
createEmployees();
