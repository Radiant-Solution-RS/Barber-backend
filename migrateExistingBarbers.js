/**
 * Migration Script: Create User Accounts for Existing Barbers
 * 
 * This script will:
 * 1. Find all existing barbers
 * 2. Check if they have a user account
 * 3. Create user accounts for barbers without one
 * 4. Assign appropriate role based on email/name
 * 
 * Usage: node migrateExistingBarbers.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Barber = require('./models/Barber');

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
 * Determine role based on barber info
 */
function determineRole(barber) {
  const email = barber.email?.toLowerCase() || '';
  const name = barber.name?.toLowerCase() || '';
  
  // Check for owner
  if (email.includes('owner') || name.includes('owner')) {
    return 'owner';
  }
  
  // Check for admin
  if (email.includes('admin') || name.includes('admin')) {
    return 'admin';
  }
  
  // Default to receptionist
  return 'receptionist';
}

/**
 * Generate a temporary password
 */
function generatePassword(barber) {
  // Use first name + 123 as default password
  const firstName = barber.name.split(' ')[0].toLowerCase();
  return `${firstName}123`;
}

/**
 * Main migration function
 */
async function migrateBarbers() {
  try {
    console.log('\n🚀 Starting migration for existing barbers...\n');
    console.log('='.repeat(60));
    
    // Get all barbers
    const barbers = await Barber.find();
    console.log(`\n📊 Found ${barbers.length} barbers in database\n`);
    
    if (barbers.length === 0) {
      console.log('⚠️  No barbers found. Nothing to migrate.');
      return;
    }

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const credentials = [];

    for (const barber of barbers) {
      console.log(`\n📝 Processing: ${barber.name} (${barber.email || 'No email'})`);
      
      // Skip if no email
      if (!barber.email) {
        console.log('   ⚠️  Skipped - No email address');
        skipped++;
        continue;
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email: barber.email });
      
      if (existingUser) {
        console.log(`   ℹ️  User account already exists`);
        console.log(`   📧 Email: ${existingUser.email}`);
        console.log(`   🎭 Role: ${existingUser.role.toUpperCase()}`);
        skipped++;
        continue;
      }

      // Determine role
      const role = determineRole(barber);
      
      // Generate password
      const password = generatePassword(barber);
      const hashedPassword = await bcrypt.hash(password, 10);

      try {
        // Create user account
        const user = new User({
          name: barber.name,
          email: barber.email,
          password: hashedPassword,
          phone: barber.phone || '',
          role: role,
        });

        await user.save();

        console.log(`   ✅ User account created successfully!`);
        console.log(`   📧 Email: ${barber.email}`);
        console.log(`   🔑 Password: ${password}`);
        console.log(`   🎭 Role: ${role.toUpperCase()}`);
        
        created++;
        credentials.push({
          name: barber.name,
          email: barber.email,
          password: password,
          role: role
        });

      } catch (createError) {
        console.log(`   ❌ Failed to create user: ${createError.message}`);
        failed++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📋 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Created: ${created}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${barbers.length}`);

    // Display credentials
    if (credentials.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('🔐 NEW LOGIN CREDENTIALS');
      console.log('='.repeat(60));
      console.log('\n⚠️  IMPORTANT: Save these credentials!\n');
      
      credentials.forEach((cred, index) => {
        console.log(`${index + 1}. ${cred.name.toUpperCase()}`);
        console.log(`   Email: ${cred.email}`);
        console.log(`   Password: ${cred.password}`);
        console.log(`   Role: ${cred.role.toUpperCase()}`);
        console.log('');
      });

      console.log('='.repeat(60));
      console.log('📝 NOTE: Employees can change their password after first login');
      console.log('='.repeat(60));
    }

    console.log('\n✅ Migration completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed\n');
    process.exit(0);
  }
}

// Run the migration
migrateBarbers();
