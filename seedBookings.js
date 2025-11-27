const mongoose = require('mongoose');
require('dotenv').config();
const Booking = require('./models/Booking');
const User = require('./models/User');
const Barber = require('./models/Barber');
const Service = require('./models/Service');


const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/barber-shop';

const seedBookings = async () => {
	try {
		console.log(' Starting to seed bookings...');
		console.log(' Connecting to MongoDB...');

		
		await mongoose.connect(MONGODB_URI);
		console.log(' Connected to MongoDB successfully!');

		
		const customers = await User.find({ role: 'customer' }).limit(10);
		const barbers = await Barber.find().limit(5);
		const services = await Service.find().limit(5);

		if (customers.length === 0) {
			console.log(' No customers found. Please create customers first.');
			return;
		}

		if (barbers.length === 0) {
			console.log(' No barbers found. Please create barbers first.');
			return;
		}

		if (services.length === 0) {
			console.log(' No services found. Please create services first.');
			return;
		}

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		await Booking.deleteMany({
			date: {
				$gte: today,
				$lt: tomorrow
			}
		});
		console.log('  Cleared existing bookings for today');
		
		const timeSlots = [
			'9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
			'1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM',
			'5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM'
		];

		const statuses = ['confirmed', 'pending', 'completed'];
		const bookingsToCreate = [];
		
		barbers.forEach((barber, barberIndex) => {
			
			const numAppointments = Math.floor(Math.random() * 4) + 5;
			
			const usedTimeSlots = new Set();
			
			for (let i = 0; i < numAppointments; i++) {
				
				let timeSlot;
				let attempts = 0;
				do {
					timeSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)];
					attempts++;
				} while (usedTimeSlots.has(timeSlot) && attempts < 20);
				
				if (usedTimeSlots.has(timeSlot)) continue;
				usedTimeSlots.add(timeSlot);

				const customer = customers[Math.floor(Math.random() * customers.length)];
				const service = services[Math.floor(Math.random() * services.length)];
				const status = statuses[Math.floor(Math.random() * statuses.length)];

				bookingsToCreate.push({
					user: customer._id,
					barber: barber._id,
					service: service._id,
					serviceName: service.name,
					date: today,
					time: timeSlot,
					status: status,
					price: service.price || Math.floor(Math.random() * 50) + 20,
					isPaid: Math.random() > 0.5,
					location: {
						id: 'main-shop',
						name: 'Main Shop',
						address: '123 Barber Street'
					},
					createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) 
				});
			}
		});

		
		const insertedBookings = await Booking.insertMany(bookingsToCreate);
		
		console.log(` Successfully created ${insertedBookings.length} bookings!`);
		console.log(` Date: ${today.toLocaleDateString()}`);
		console.log(` ${barbers.length} barbers with appointments`);
		console.log(` Status breakdown:`);
		
		const statusCount = {};
		insertedBookings.forEach(b => {
			statusCount[b.status] = (statusCount[b.status] || 0) + 1;
		});
		
		Object.keys(statusCount).forEach(status => {
			console.log(`   - ${status}: ${statusCount[status]}`);
		});

		mongoose.connection.close();
		console.log('\n Seeding completed successfully!');
		process.exit(0);

	} catch (error) {
		console.error(' Error seeding bookings:', error);
		mongoose.connection.close();
		process.exit(1);
	}
};

seedBookings();
