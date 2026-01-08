/**
 * List All E    
 * 
 * 
employees with Login Access
 * 
 * This script displays all users and their login credentials
 * (Note: Passwords are hashed, so we can't show them - only emails)
 * 
 * Usage: node listAllEmployees.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
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

async function listAllEmployees() {
  try {
    console.log('\n📋 ALL EMPLOYEES & LOGIN ACCESS');
    console.log('='.repeat(70));
    
    // Get all users (staff only, not customers)
    const staffUsers = await User.find({ 
      role: { $in: ['receptionist', 'admin', 'owner'] } 
    }).sort({ role: -1, name: 1 });
    
    // Get all barbers
    const barbers = await Barber.find().sort({ name: 1 });
    
    console.log(`\n👥 Total Staff Accounts: ${staffUsers.length}`);
    console.log(`💈 Total Barber Profiles: ${barbers.length}`);
    console.log('\n' + '='.repeat(70));

    if (staffUsers.length === 0) {
      console.log('\n⚠️  No staff accounts found!');
      console.log('   Run: node createEmployee.js to create accounts\n');
      return;
    }

    // Group by role
    const byRole = {
      owner: [],
      admin: [],
      receptionist: []
    };

    staffUsers.forEach(user => {
      byRole[user.role].push(user);
    });

    // Display by role
    ['owner', 'admin', 'receptionist'].forEach(role => {
      const users = byRole[role];
      if (users.length === 0) return;

      console.log(`\n🎭 ${role.toUpperCase()} (${users.length})`);
      console.log('-'.repeat(70));

      users.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.name}`);
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   📱 Phone: ${user.phone || 'Not provided'}`);
        console.log(`   🔑 Password: ******** (hashed)`);
        console.log(`   📅 Created: ${new Date(user.createdAt).toLocaleDateString()}`);
        
        // Check if has barber profile
        const hasBarberProfile = barbers.some(b => b.email === user.email);
        if (hasBarberProfile) {
          console.log(`   💈 Barber Profile: ✅ Yes`);
        } else {
          console.log(`   💈 Barber Profile: ❌ No`);
        }
      });
    });

    // Barbers without user accounts
    console.log('\n\n🚨 BARBERS WITHOUT LOGIN ACCESS');
    console.log('-'.repeat(70));

    const barbersWithoutAccount = barbers.filter(barber => {
      if (!barber.email) return false;
      return !staffUsers.some(user => user.email === barber.email);
    });

    if (barbersWithoutAccount.length === 0) {
      console.log('\n✅ All barbers with email have user accounts!');
    } else {
      console.log(`\n⚠️  Found ${barbersWithoutAccount.length} barber(s) without user account:\n`);
      barbersWithoutAccount.forEach((barber, index) => {
        console.log(`${index + 1}. ${barber.name} - ${barber.email}`);
      });
      console.log('\n💡 TIP: Run "node migrateExistingBarbers.js" to create accounts for them');
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    console.log(`Owners: ${byRole.owner.length}`);
    console.log(`Admins: ${byRole.admin.length}`);
    console.log(`Receptionists: ${byRole.receptionist.length}`);
    console.log(`Barbers without login: ${barbersWithoutAccount.length}`);
    console.log('='.repeat(70));
    console.log('\n💡 NOTE: Passwords are encrypted and cannot be displayed');
    console.log('   If you forgot a password, you need to reset it manually\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed\n');
    process.exit(0);
  }
}

// Run
listAllEmployees();
